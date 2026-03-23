variable "VERSION" {
  default = "latest"
}

variable "REPO" {
  default = "ghcr.io/rwth-pads/ocelescope"
}

group "default" {
  targets = ["backend", "frontend"]
}

target "backend" {
  dockerfile = "./src/backend/Dockerfile"
  contexts = {
    data       = "./data"
  }

  tags = [
    "grkmr/ocelescope_backend:${VERSION}",
    "grkmr/ocelescope_backend:latest",
  ]
}

target "frontend" {
  context = "./src/frontend"
  dockerfile = "Dockerfile"

  tags = [
    "grkmr/ocelescope_frontend:${VERSION}",
    "grkmr/ocelescope_frontend:latest",
  ]
}

