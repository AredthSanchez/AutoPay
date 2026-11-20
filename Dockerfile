FROM node:22-alpine AS frontend
WORKDIR /ui
COPY frontend/package.json ./
RUN npm install --ignore-scripts
COPY frontend/ ./
ENV VITE_BACKEND=true
RUN npm run build
FROM maven:3.9.11-eclipse-temurin-21 AS backend
WORKDIR /app
COPY backend/pom.xml ./
COPY backend/src ./src
COPY --from=frontend /ui/dist ./src/main/resources/static
RUN mvn -B package
FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S autopay && adduser -S autopay -G autopay
WORKDIR /app
RUN mkdir -p /app/uploads && chown autopay:autopay /app/uploads
COPY --from=backend /app/target/autopay-1.0.0.jar ./app.jar
USER autopay
EXPOSE 8080
ENTRYPOINT ["java","-jar","app.jar"]
