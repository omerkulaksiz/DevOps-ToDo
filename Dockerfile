# Use an OpenJDK Runtime as a parent image
FROM eclipse-temurin:17-jdk-alpine
# Define the jar file location
ARG JAR_FILE=target/*.jar
# Copy the jar into the container
COPY ${JAR_FILE} app.jar
# Run the jar
ENTRYPOINT ["java", "-jar", "/app.jar"]