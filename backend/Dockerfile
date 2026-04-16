# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build binary
RUN CGO_ENABLED=0 GOOS=linux go build -o wms-backend .

# Run stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata
ENV TZ=Asia/Jakarta

WORKDIR /root/

# Copy binary from builder
COPY --from=builder /app/wms-backend .

# Expose port (Koyeb uses PORT env var)
EXPOSE 8080

CMD ["./wms-backend"]
