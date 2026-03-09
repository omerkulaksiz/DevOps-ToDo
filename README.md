# DevOps-ToDo

Projekt im Modul **DevOps**  

Aufbau einer vollständigen CI/CD-Pipeline für eine Spring Boot Anwendung mit REST API

**eine einfache ToDo WebApp**

## Tech Stack

- Java 17
- Spring Boot
- Maven
- REST API (JSON)
- HTML / CSS / JavaScript
- Docker 
- GitHub Actions
- SonarQube
- MySQL
- PHPMyAdmin
- Nginx

## Anwendung starten

.env.example --> .env
    - Variablen beliebig definieren

```bash
git clone git@github.com:omerkulaksiz/DevOps-ToDo.git

./mvnw clean package -DskipTests

docker compose up -d --build
```

API läuft unter:
http://localhost:8080/api/tasks

DB läuft unter:
http://localhost:3306

WebServer läuft unter:
http://localhost:8080

PHPMyAdmin läuft unter:
http://localhost:9999

# REST API

| Methode | Endpoint | Beschreibung |
|--------|----------|-------------|
| GET | /api/tasks | alle Tasks abrufen |
| POST | /api/tasks | neuen Task erstellen |
| PUT | /api/tasks/{id} | Task aktualisieren |
| PATCH | /api/tasks/{id}/complete | Task als erledigt markieren |
| DELETE | /api/tasks/{id} | Task löschen |




