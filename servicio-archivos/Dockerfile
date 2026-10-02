FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --only=production

COPY src ./src

# Crear carpeta de uploads dentro del contenedor.
RUN mkdir -p uploads

EXPOSE 3012

CMD ["npm", "start"]
