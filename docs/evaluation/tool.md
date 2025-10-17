# Tool Evaluation

In this evaluation, we assess the usability and functionality of Ocelescope by simulating a common research scenario: trying out the implementation of a tool introduced in a scientific paper. As an example, we use the plugin for TOTeM — a technique proposed for object-centric process mining.

!!! note "System Requirements"
    To run Ocelescope locally, you must have [Docker](https://docs.docker.com/get-docker/){target="_blank"} and [Docker Compose](https://docs.docker.com/compose/install/){target="_blank"} installed on your system.

## Step 1: Get Ocelescope Running

The first step is to get Ocelescope up and running on your machine.

Please follow the instructions in the [Getting Started](../index.md){target="_blank"} section to set up and launch Ocelescope using Docker.

!!! info "Ocelescope Frontend"
    After starting the application, access the frontend at [http://localhost:3000](http://localhost:3000).

## Step 2: Download and Upload the TOTeM Plugin

First, download the TOTeM plugin using the button below:

<div class="grid cards" markdown>

* :simple-github:{ .lg .middle } **TOTeM**

    ---

    Generate Temporal Object Type Models (TOTeM) to uncover type-level temporal and cardinality relations in event logs

    [:material-download: Download](https://github.com/Grkmr/TOTeM/releases/download/v1.3/totem.zip)

</div>

Next, upload the plugin into Ocelescope. Once uploaded, the TOTeM plugin will appear in the plugin list and is ready to use.

## Step 3: Load a Default Event Log

To run the plugin, you need an event log. Ocelescope provides several example OCEL logs that you can use for testing.

In this example, we will use the **Container Logistics** log.

Once imported, the log will appear in your list of available logs and can be used with the TOTeM plugin.

## Step 4: Run the TOTeM Plugin

Once the Container Logistics log is loaded, navigate to the TOTeM plugin in Ocelescope and run the **Discover TOTeM** method. Try different `τ` (tau) values to explore how the results change — for example, use `0.9` and `0.3`.

After running the method, download the resulting files.

When you're done, return to the evaluation form and upload the generated results.
