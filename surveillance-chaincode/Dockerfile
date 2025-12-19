FROM node:18-alpine
WORKDIR /app
# Copy package files
COPY package*.json ./
# Install only production dependencies
RUN npm ci --only=production
# Copy built chaincode (the dist folder from npm run build)
COPY dist ./dist
# Expose chaincode port
EXPOSE 7052
# Set environment variables with defaults
ENV CHAINCODE_SERVER_ADDRESS=0.0.0.0:7052
ENV CHAINCODE_ID=default_id
# Start chaincode in SERVER mode - use shell form for variable expansion
CMD node_modules/.bin/fabric-chaincode-node server --chaincode-address=$CHAINCODE_SERVER_ADDRESS --chaincode-id=$CHAINCODE_ID
