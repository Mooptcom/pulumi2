# Build stage
FROM geoffreybooth/meteor-base:3.1.2 as builder

# Copy package files first to leverage Docker cache
COPY package*.json /app/
RUN cd /app && meteor npm install

# Copy the rest of the app
COPY . /app

# Build the app
RUN cd /app && \
    meteor build --directory /opt/bundle --server-only

# Production stage
FROM node:18-slim

# Copy the built app
COPY --from=builder /opt/bundle/bundle /app

# Install production dependencies
WORKDIR /app/programs/server
RUN npm install

# Set up environment
WORKDIR /app
ENV PORT=8080
ENV ROOT_URL=http://localhost:8080
ENV MONGO_URL=mongodb+srv://placeholder

# Expose the application port
EXPOSE 8080

# Start the app
CMD ["node", "main.js"]