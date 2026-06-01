# Getting Started

!!! note "System Requirements"
    To run Ocelescope locally, you must have [Docker](https://docs.docker.com/get-docker/){target="_blank"} and [Docker Compose](https://docs.docker.com/compose/install/){target="_blank"} installed on your system.

To get Ocelescope running docker compose. To run ocelescope you can just use the below docker compose script.

```yaml title="docker-compose.yaml"
services:
  backend:
    image: ghcr.io/promi4s/ocelescope-backend:latest
    volumes:
      - plugins_store:/plugins
    restart: unless-stopped
  frontend: 
    image: ghcr.io/promi4s/ocelescope-frontend:latest
    ports:
      - "3000:3000"
    restart: unless-stopped

volumes:
  plugins_store:
```

[:material-download: Download](./assets/docker-compose.yaml){ .md-button download="docker-compose.yaml" }

### Starting the Services

Run the following command in the same directory as your `docker-compose.yml`:

```bash
docker compose up -d
```

This will start both the **backend** (API) and **frontend** (web interface).

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

{% for plugin in plugins %}

* :simple-github:{ .lg .middle } **[{{ plugin.name }}]({{ plugin.repo_url }})**

    ---
    {{ plugin.description }}

    {% if plugin.download_url %}
    [:material-download: Download]({{ plugin.download_url }}){ .md-button }
    {% endif %}

{% endfor %}

</div>
