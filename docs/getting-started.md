# Getting Started

You can run Ocelescope using the following `docker-compose` configuration:

```yaml
services:
  backend:
    image: grkmr/ocelescope_backend:latest
    ports:
      - "8000:8000"
    volumes:
      - plugins_store:/plugins
    environment:
      - PLUGIN_DIR=/plugins 
    restart: unless-stopped

  frontend:
    image: grkmr/ocelescope_frontend:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped

volumes:
  plugins_store:
```

### Starting the Services

Run the following command in the same directory as your `docker-compose.yml`:

```bash
docker compose up -d
```

This will start both the **backend** (API) and **frontend** (web interface).

### Accessing Ocelescope

* **Frontend (Web UI):** [http://localhost:3000](http://localhost:3000)
* **Backend (API):** [http://localhost:8000](http://localhost:8000)

### Uploading Plugins

You can upload plugins directly from the **web interface** at:

👉 [http://localhost:3000/plugins](http://localhost:3000/plugins)

Uploaded plugins will be stored in the `plugins_store` volume and made available for execution.

### Example Plugins

Here are some example plugins you can explore and use with Ocelescope:

* [**pm4py-discovery**](https://github.com/Grkmr/pm4py-discovery) – Integrates process discovery algorithms from the PM4Py library.
* [**TOTeM**](https://github.com/Grkmr/TOTeM) – Provides temporal object-centric model mining capabilities.

These plugins can be uploaded via the web interface and will extend Ocelescope with additional analysis features.

### Stopping Ocelescope

To stop the services, run:

```bash
docker compose down
```
