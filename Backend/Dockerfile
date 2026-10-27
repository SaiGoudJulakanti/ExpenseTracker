
FROM maven:3.9-eclipse-temurin-17

WORKDIR /app

COPY pom.xml .
COPY src ./src

RUN mvn -DskipTests package

EXPOSE 8080

CMD ["sh", "-c", "mvn -q exec:java"]
