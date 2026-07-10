variable "VERSION" {
  default = "latest"
}

variable "REPO" {
  default = "ghcr.io/promi4s/ocelescope"
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
    "${REPO}-backend:${VERSION}",
    "${REPO}-backend:latest",
  ]
}

target "frontend" {
  dockerfile = "./src/frontend/Dockerfile"

  args = {
    NEXT_PUBLIC_APP_VERSION = "${VERSION}"
  }

  tags = [
    "${REPO}-frontend:${VERSION}",
    "${REPO}-frontend:latest",
  ]
}

