# DevOps-ToDo

A simple full-stack ToDo application built with **Spring Boot** and **JavaScript**, created to practice **DevOps workflows**, **CI/CD automation**, and **code quality analysis**.

---

## Features

* Create, update, complete, and delete tasks
* REST API built with Spring Boot
* Simple frontend served by the backend
* Automated testing and static code analysis
* SonarCloud integration with JaCoCo coverage reporting
* Docker-based containerization

---

## Tech Stack

* **Backend:** Java 17, Spring Boot 3
* **Build Tool:** Maven
* **Frontend:** HTML, CSS, JavaScript
* **Database:** MySQL, Azure SQL, H2
* **Testing:** JUnit
* **Code Quality:** SonarCloud, JaCoCo
* **CI/CD:** GitHub Actions
* **Containerization:** Docker

---

## Architecture

The application follows a simple layered Spring Boot architecture:

* **Controller** – handles HTTP requests
* **Service** – contains business logic
* **Repository** – handles database access
* **Entity** – represents the task model

This structure keeps the project modular and easy to maintain.

---

## Project Structure

```text
app/
├── src/
│   ├── main/
│   │   ├── java/        # backend source code
│   │   └── resources/   # configuration and static frontend
│   └── test/            # test classes
├── pom.xml
├── Dockerfile
```

---

## Environments

The project uses three clearly separated environments:

1. **Local Development**  
   Used for developing and testing the application directly on localhost.

2. **Docker Environment**  
   Used to run the application together with its required services in isolated containers via Docker Compose.

3. **Cloud Deployment**  
   Used for deployment on Azure with environment-specific production configuration.

This setup helps avoid configuration conflicts and keeps each environment independent.

---

## Run Locally

### Start the application

```bash
cd app
./mvnw spring-boot:run
```

The application will run on:

```text
http://localhost:8080
```

---

## Run App Locally

Create a local `.env` file based on `.env.example` and define your own environment variables.

### Start the Application

```bash
./mvnw spring-boot:run
```

---

### Run Tests

```bash
./mvnw test
```

---

### Build the Project

```bash
./mvnw clean package
```

---

## Run with Docker

This project uses Docker Compose to run multiple containers together, including the application and its required services.

### Build and start all containers

```bash
./mvnw clean package -DskipTests
docker compose up -d --build
```

### Stop all containers

```bash
docker compose down
```

---

## Code Quality

This project uses:

* **SonarCloud** for static code analysis
* **JaCoCo** for test coverage reporting

Coverage reports are generated during CI and automatically passed to SonarCloud.

---

## CI/CD

The GitHub Actions workflow includes:

* project build
* automated tests
* JaCoCo coverage generation
* SonarCloud analysis
* deployment preparation

This ensures that code quality checks are part of the CI pipeline before deployment.

---

## Purpose

This project was created to practice:

* backend development with Spring Boot
* Git and GitHub collaboration
* CI/CD pipeline design
* automated testing and code quality checks
* containerized deployment


