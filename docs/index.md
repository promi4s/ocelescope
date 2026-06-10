
# Getting Started

!!! note "System Requirements"
    To run Ocelescope locally, you must have [Docker](https://docs.docker.com/get-docker/){target="_blank"} and [Docker Compose](https://docs.docker.com/compose/install/){target="_blank"} installed on your system.

To get Ocelescope running with Docker Compose, you can use the configuration below.

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

## Starting the Services

Run the following command in the same directory as your `docker-compose.yml`:

```bash
docker compose up -d
```

This will start both the **backend** (API) and **frontend** (web interface).

## Uploading Plugins

You can upload plugins directly from the **web interface** at:

👉 [http://localhost:3000/plugins](http://localhost:3000/plugins)

Uploaded plugins will be stored in the `plugins_store` volume and made available for execution.

## Stopping Ocelescope

To stop the services, run:

```bash
docker compose down
```

## Example Plugins

Here are some example plugins you can explore and use with Ocelescope.

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

## Submit Your Plugin

Want to add your plugin to this page?

[:material-file-document-edit: Submit your plugin](https://github.com/promi4s/ocelescope/issues/new?template=plugin-submission.yml){ .md-button .md-button--primary }

## Report Issues & Request Features

For bug reports, feature requests, and plugin environment package requests, please use our GitHub issue templates:

* [Report a bug](https://github.com/promi4s/ocelescope/issues/new?template=bug-report.yml)
* [Request a feature](https://github.com/promi4s/ocelescope/issues/new?template=feature-request.yml)
* [Request a plugin environment package](https://github.com/promi4s/ocelescope/issues/new?template=plugin-package-request.yml)
