# Getting Started

!!! note "System Requirements"
    To run Ocelescope locally, you must have [Docker](https://docs.docker.com/get-docker/){target="_blank"} and [Docker Compose](https://docs.docker.com/compose/install/){target="_blank"} installed on your system.

To get Ocelescope running docker compose. To run ocelescope you can just use the below docker compose script.

```yaml title="docker-compose.yaml"
services:
  backend:
    image: grkmr/ocelescope_backend:latest
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

* :simple-github:{ .lg .middle } **[PM4PY Discovery](https://github.com/Grkmr/pm4py-discovery)**

    ---
    Discover object-centric process models through the discovery algorithms of the [PM4PY](https://processintelligence.solutions/pm4py) python library

    [:material-download: Download](https://github.com/Grkmr/pm4py-discovery/releases/download/v1.0.2/Pm4pyDiscovery.zip){ .md-button }

* :simple-github:{ .lg .middle } **[TOTeM](https://github.com/Grkmr/TOTeM)**

    ---

    Generate Temporal Object Type Models ([:material-book-open-variant: TOTeM](https://doi.org/10.1007/978-3-031-70418-5_7)) to uncover type-level temporal and cardinality relations in event logs

    [:material-download: Download](https://github.com/Grkmr/TOTeM/releases/download/v1.5/Totem.zip){ .md-button }

* :simple-github:{ .lg .middle } **[OC-DECLARE](https://github.com/Grkmr/OC-Declare)**

    ---
    Discover and check **object-centric declarative process constraints** ([:material-book-open-variant: OC-DECLARE](https://doi.org/10.1007/978-3-032-02867-9_11)) from object-centric event logs. Proof of concept for using **Rust via Python bindings** in Ocelescope plugins.

    [:material-download: Download](https://github.com/Grkmr/OC-Declare/releases/download/v1.0.3/OcDeclare.zip){ .md-button }

* :simple-github:{ .lg .middle } **[Discqvery](https://github.com/Grkmr/qnets)**

    ---
    Proof of concept for **extended OCELs** with [:material-book-open-variant: **quantity states**](https://doi.org/10.1007/978-3-031-82225-4_25) to better model logistics processes. An example extended log is available [here](./assets/QEL_Inventory_Management_extended.xml){download="discqverylog.xml" }.

    [:material-download: Download](https://github.com/Grkmr/qnets/releases/download/v1.0.4/Discqvery.zip){ .md-button }

* :simple-github:{ .lg .middle } **[OCEL Graph](https://github.com/Grkmr/OcelGraph)**

    ---
    Result of the **plugin development tutorial**: generates an **OCEL Graph** (spanning tree) from a selected object/event root to visualize relationships in an event log. Follow the tutorial [here](./plugins/tutorial.md).

    [:material-download: Download](https://github.com/Grkmr/OcelGraph/releases/download/v1.0.1/OcelGraphDiscovery.zip){ .md-button }

</div>
