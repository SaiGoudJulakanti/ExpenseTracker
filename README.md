# Expense Tracker 💰

A full-stack Expense Tracker project built using **Java, MySQL, HTML, CSS, and JavaScript**. The application is designed to help users manage their income and expenses, track their balance, and organize transactions through a simple web interface.

## 🌐 Live Demo

**Frontend:** [Expense Tracker Website](https://lovely-pudding-ae50aa.netlify.app)

> Note: The frontend is deployed on Netlify. The Java backend and MySQL database are currently under development and have not yet been deployed to a public hosting service.

## 🚀 Features

- User-friendly web interface
- Dashboard for tracking income and expenses
- Transaction management interface
- Separate transactions and reports pages
- Category-based expense organization
- Responsive design
- Java backend using the built-in `HttpServer`
- JDBC-based database connectivity
- MySQL database integration planned

## 🛠️ Technologies Used

**Frontend**

- HTML5
- CSS3
- JavaScript

**Backend**

- Java
- Java `HttpServer`
- JDBC
- Maven

**Database**

- MySQL

**Tools and Deployment**

- Git and GitHub
- Netlify
- Docker (backend deployment preparation)

## 📁 Project Structure

```text
ExpenseTracker/
├── Frontend/
│   ├── index.html
│   ├── transactions.html
│   ├── reports.html
│   ├── script.js
│   └── style.css
├── Backend/
│   ├── Dockerfile
│   ├── pom.xml
│   └── src/
│       └── main/
│           └── java/
│               └── com/
│                   └── expensetracker/
│                       └── ExpenseTrackerServer.java
└── README.md
```

## ⚙️ Prerequisites

To run the project locally, install:

- Java 17 or later
- Apache Maven
- MySQL Server
- Python 3

## 💻 Run Locally

### 1. Clone the repository

```bash
git clone https://github.com/SaiGoudJulakanti/ExpenseTracker.git
cd ExpenseTracker
```

### 2. Configure MySQL

Start your local MySQL server and create the database:

```sql
CREATE DATABASE ExpenseTracker;
```

Configure the database connection using the environment variables expected by the backend. Never commit database passwords to GitHub.

### 3. Start the backend

Open a terminal:

```bash
cd Backend
mvn compile exec:java
```

If the database connection and configuration are correct, the backend should start on port `8080`.

Test the health endpoint:

```bash
curl http://localhost:8080/api/health
```

### 4. Start the frontend

Open a separate terminal from the project root:

```bash
cd Frontend
python3 -m http.server 5500
```

Open the website:

[http://localhost:5500](http://localhost:5500)

Keep both terminal sessions running while testing the application.

## 🔌 Backend API

The backend health endpoint is available locally at:

```text
http://localhost:8080/api/health
```

Transaction API routes will depend on the endpoints implemented in the Java backend.

## 🚧 Project Status

- [x] Frontend development
- [x] Frontend deployment on Netlify
- [x] Java backend development started
- [x] Local backend health check
- [ ] Public backend deployment
- [ ] Production MySQL database deployment
- [ ] Connect the deployed frontend to the public backend
- [ ] Complete end-to-end testing

## 🔐 Security

- Store credentials in environment variables.
- Never expose database passwords in frontend JavaScript.
- Configure CORS for trusted frontend origins.
- Use HTTPS for public API communication.
- Keep database access restricted to trusted applications.

## 🎯 Learning Objectives

This project helps demonstrate practical experience with:

- Java application development
- HTTP server and API fundamentals
- JDBC and MySQL integration
- Frontend and backend communication
- Maven dependency management
- Git and GitHub version control
- Docker-based deployment preparation

## 👨‍💻 Author

**Sai Goud Julakanti**

GitHub: [SaiGoudJulakanti](https://github.com/SaiGoudJulakanti)

---

⭐ If you find this project interesting, consider giving the repository a star.
