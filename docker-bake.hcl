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
  context = "./src/backend"
  dockerfile = "Dockerfile"
  contexts = {
    ocelescope = "./src/ocelescope"
    data       = "./data"
  }

  tags = [
    "${REPO}-backend:${VERSION}",
    "${REPO}-backend:latest",
  ]
}

target "frontend" {
  context = "./src/frontend"
  dockerfile = "Dockerfile"

  tags = [
    "${REPO}-frontend:${VERSION}",
    "${REPO}-frontend:latest",
  ]
}

