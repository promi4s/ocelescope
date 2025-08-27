# Getting Started

To get Ocelescope running docker compose. To run it you have to have docker-compose or docker installed. To run ocelescope you can just use the below docker compose script.

```yaml title="docker-compose.yaml"
services:
  backend:
    image: grkmr/ocelescope_backend:latest
    ports:
      - "8000:8000"
    volumes:
      - plugins_store:/plugins
    restart: unless-stopped

  frontend:
    image: grkmr/ocelescope_frontend:latest
    ports:
      - "3000:3000"
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

### Stopping Ocelescope

To stop the services, run:

```bash
docker compose down
```

### Example Plugins

Here are some example plugins you can explore and use with Ocelescope

<div class="grid cards" markdown>

* :simple-github:{ .lg .middle } **PM4PY Discovery**

    ---
    Discover object-centric process models through the discovery algorithms of the [PM4PY](https://processintelligence.solutions/pm4py) python library

    [:material-download: Download](https://github.com/Grkmr/pm4py-discovery/releases/download/v1.0/pm4py_discovery.zip)

* :simple-github:{ .lg .middle } **TOTeM**

    ---

    Generate Temporal Object Type Models (TOTeM) to uncover type-level temporal and cardinality relations in event logs

    [:material-download: Download](https://github.com/Grkmr/TOTeM/releases/download/v1.0/totem.zip)

</div>
