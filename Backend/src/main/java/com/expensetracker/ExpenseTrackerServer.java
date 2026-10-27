
package com.expensetracker;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class ExpenseTrackerServer {

    private static final int PORT = 8080;
    private static final String DB_URL =
            "jdbc:mysql://localhost:3306/ExpenseTracker?serverTimezone=UTC";

    private static final String DB_USER = "root";
    private static final String DB_PASSWORD =
            System.getenv().getOrDefault("EXPENSETRACKER_DB_PASSWORD", "");

    private static final Gson gson = new Gson();

    public static void main(String[] args) throws Exception {
        // Check the database connection before starting the server.
        try (Connection connection = getConnection()) {
            System.out.println("MySQL connection successful!");
        }

        HttpServer server = HttpServer.create(
                new InetSocketAddress(PORT), 0);

        server.createContext("/api/health", exchange -> {
            addCorsHeaders(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendResponse(exchange, 204, "");
                return;
            }

            JsonObject response = new JsonObject();
            response.addProperty("status", "running");
            response.addProperty("database", "ExpenseTracker");

            sendJson(exchange, 200, response);
        });

        server.createContext("/api/transactions", exchange -> {
            addCorsHeaders(exchange);

            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                sendResponse(exchange, 204, "");
                return;
            }

            try {
                String method = exchange.getRequestMethod();
                String path = exchange.getRequestURI().getPath();

                if ("GET".equalsIgnoreCase(method)) {
                    if (path.matches("/api/transactions/\\d+")) {
                        long id = Long.parseLong(
                                path.substring(path.lastIndexOf('/') + 1));
                        Transaction transaction = getTransaction(id);

                        if (transaction == null) {
                            sendError(exchange, 404, "Transaction not found");
                        } else {
                            sendJson(exchange, 200, transaction);
                        }
                    } else {
                        sendJson(exchange, 200, getTransactions());
                    }
                } else if ("POST".equalsIgnoreCase(method)) {
                    JsonObject body = readJson(exchange);
                    Transaction transaction = fromJson(body);
                    validate(transaction);

                    long id = insertTransaction(transaction);
                    transaction.id = id;

                    sendJson(exchange, 201, transaction);
                } else if ("PUT".equalsIgnoreCase(method)) {
                    if (!path.matches("/api/transactions/\\d+")) {
                        sendError(exchange, 400,
                                "Provide a transaction ID in the URL");
                        return;
                    }

                    long id = Long.parseLong(
                            path.substring(path.lastIndexOf('/') + 1));

                    JsonObject body = readJson(exchange);
                    Transaction transaction = fromJson(body);
                    validate(transaction);

                    if (updateTransaction(id, transaction)) {
                        transaction.id = id;
                        sendJson(exchange, 200, transaction);
                    } else {
                        sendError(exchange, 404, "Transaction not found");
                    }
                } else if ("DELETE".equalsIgnoreCase(method)) {
                    if (!path.matches("/api/transactions/\\d+")) {
                        sendError(exchange, 400,
                                "Provide a transaction ID in the URL");
                        return;
                    }

                    long id = Long.parseLong(
                            path.substring(path.lastIndexOf('/') + 1));

                    if (deleteTransaction(id)) {
                        JsonObject response = new JsonObject();
                        response.addProperty("message",
                                "Transaction deleted successfully");
                        sendJson(exchange, 200, response);
                    } else {
                        sendError(exchange, 404, "Transaction not found");
                    }
                } else {
                    exchange.getResponseHeaders().set("Allow",
                            "GET, POST, PUT, DELETE, OPTIONS");
                    sendError(exchange, 405, "Method not allowed");
                }

            } catch (IllegalArgumentException e) {
                sendError(exchange, 400, e.getMessage());
            } catch (Exception e) {
                e.printStackTrace();
                sendError(exchange, 500, "Server error: " + e.getMessage());
            }
        });

        server.setExecutor(null);
        server.start();

        System.out.println("Expense Tracker backend running at:");
        System.out.println("http://localhost:" + PORT);
        System.out.println("Health check: http://localhost:" + PORT
                + "/api/health");
    }

    private static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
    }

    private static List<Transaction> getTransactions() throws SQLException {
        List<Transaction> transactions = new ArrayList<>();

        String sql = "SELECT * FROM transactions ORDER BY transaction_date DESC, id DESC";

        try (Connection connection = getConnection();
             PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet rs = statement.executeQuery()) {

            while (rs.next()) {
                transactions.add(mapTransaction(rs));
            }
        }

        return transactions;
    }

    private static Transaction getTransaction(long id) throws SQLException {
        String sql = "SELECT * FROM transactions WHERE id = ?";

        try (Connection connection = getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {

            statement.setLong(1, id);

            try (ResultSet rs = statement.executeQuery()) {
                return rs.next() ? mapTransaction(rs) : null;
            }
        }
    }

    private static long insertTransaction(Transaction t) throws SQLException {
        String sql = """
                INSERT INTO transactions
                (title, amount, type, category, transaction_date,
                 payment_method, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """;

        try (Connection connection = getConnection();
             PreparedStatement statement = connection.prepareStatement(
                     sql, Statement.RETURN_GENERATED_KEYS)) {

            fillStatement(statement, t);
            statement.executeUpdate();

            try (ResultSet keys = statement.getGeneratedKeys()) {
                if (keys.next()) {
                    return keys.getLong(1);
                }
            }
        }

        throw new SQLException("Could not create transaction");
    }

    private static boolean updateTransaction(long id, Transaction t)
            throws SQLException {

        String sql = """
                UPDATE transactions
                SET title = ?, amount = ?, type = ?, category = ?,
                    transaction_date = ?, payment_method = ?, notes = ?
                WHERE id = ?
                """;

        try (Connection connection = getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {

            fillStatement(statement, t);
            statement.setLong(8, id);

            return statement.executeUpdate() > 0;
        }
    }

    private static boolean deleteTransaction(long id) throws SQLException {
        String sql = "DELETE FROM transactions WHERE id = ?";

        try (Connection connection = getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {

            statement.setLong(1, id);
            return statement.executeUpdate() > 0;
        }
    }

    private static void fillStatement(
            PreparedStatement statement, Transaction t)
            throws SQLException {

        statement.setString(1, t.title);
        statement.setBigDecimal(2, new java.math.BigDecimal(t.amount));
        statement.setString(3, t.type);
        statement.setString(4, t.category);
        statement.setDate(5, Date.valueOf(t.transactionDate));
        statement.setString(6, t.paymentMethod);
        statement.setString(7, t.notes);
    }

    private static Transaction mapTransaction(ResultSet rs)
            throws SQLException {

        Transaction t = new Transaction();
        t.id = rs.getLong("id");
        t.title = rs.getString("title");
        t.amount = rs.getBigDecimal("amount").toPlainString();
        t.type = rs.getString("type");
        t.category = rs.getString("category");
        t.transactionDate = rs.getDate("transaction_date").toString();
        t.paymentMethod = rs.getString("payment_method");
        t.notes = rs.getString("notes");
        return t;
    }

    private static JsonObject readJson(HttpExchange exchange)
            throws IOException {

        try (InputStream input = exchange.getRequestBody()) {
            String body = new String(
                    input.readAllBytes(), StandardCharsets.UTF_8);

            if (body.isBlank()) {
                throw new IllegalArgumentException("Request body is required");
            }

            try {
                return gson.fromJson(body, JsonObject.class);
            } catch (Exception e) {
                throw new IllegalArgumentException("Invalid JSON body");
            }
        }
    }

    private static Transaction fromJson(JsonObject json) {
        if (json == null) {
            throw new IllegalArgumentException("JSON body is required");
        }

        Transaction t = new Transaction();
        t.title = getString(json, "title");
        t.amount = getString(json, "amount");
        t.type = getString(json, "type").toUpperCase();
        t.category = getString(json, "category");
        t.transactionDate = getString(json, "transactionDate");
        t.paymentMethod = getString(json, "paymentMethod");
        t.notes = getString(json, "notes");

        if (t.paymentMethod.isBlank()) {
            t.paymentMethod = "Other";
        }

        return t;
    }

    private static String getString(JsonObject json, String key) {
        if (!json.has(key) || json.get(key).isJsonNull()) {
            return "";
        }
        return json.get(key).getAsString().trim();
    }

    private static void validate(Transaction t) {
        if (t.title.isBlank()) {
            throw new IllegalArgumentException("Title is required");
        }

        if (t.category.isBlank()) {
            throw new IllegalArgumentException("Category is required");
        }

        if (!t.type.equals("INCOME") && !t.type.equals("EXPENSE")) {
            throw new IllegalArgumentException(
                    "Type must be INCOME or EXPENSE");
        }

        try {
            java.math.BigDecimal amount =
                    new java.math.BigDecimal(t.amount);

            if (amount.compareTo(java.math.BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException(
                        "Amount must be greater than zero");
            }
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Amount must be a valid number");
        }

        try {
            Date.valueOf(t.transactionDate);
        } catch (Exception e) {
            throw new IllegalArgumentException(
                    "Date must use YYYY-MM-DD format");
        }

        if (t.paymentMethod.length() > 50) {
            throw new IllegalArgumentException(
                    "Payment method must be 50 characters or fewer");
        }

        if (t.notes.length() > 500) {
            throw new IllegalArgumentException(
                    "Notes must be 500 characters or fewer");
        }
    }

    private static void addCorsHeaders(HttpExchange exchange) {
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set(
                "Access-Control-Allow-Methods",
                "GET, POST, PUT, DELETE, OPTIONS");
        exchange.getResponseHeaders().set(
                "Access-Control-Allow-Headers", "Content-Type");
    }

    private static void sendJson(
            HttpExchange exchange, int status, Object data)
            throws IOException {

        sendResponse(exchange, status, gson.toJson(data));
    }

    private static void sendError(
            HttpExchange exchange, int status, String message)
            throws IOException {

        JsonObject error = new JsonObject();
        error.addProperty("error", message);
        sendJson(exchange, status, error);
    }

    private static void sendResponse(
            HttpExchange exchange, int status, String body)
            throws IOException {

        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);

        if (status == 204) {
            exchange.sendResponseHeaders(status, -1);
            exchange.close();
            return;
        }

        exchange.getResponseHeaders().set(
                "Content-Type", "application/json; charset=UTF-8");
        exchange.sendResponseHeaders(status, bytes.length);

        try (OutputStream output = exchange.getResponseBody()) {
            output.write(bytes);
        }
    }

    private static class Transaction {
        long id;
        String title = "";
        String amount = "";
        String type = "";
        String category = "";
        String transactionDate = "";
        String paymentMethod = "Other";
        String notes = "";
    }
}

