import json
import os
from pathlib import Path

from github import Github


def generate_plugins():
    plugin_json = Path("docs/data/plugins.json")

    plugins = json.loads(plugin_json.read_text(encoding="utf-8"))
    github = Github(os.getenv("GITHUB_TOKEN"))

    rendered_plugins = []

    for plugin in plugins:
        repo = github.get_repo(plugin["repo"])

        try:
            latest_release = repo.get_latest_release()
            assets = list(latest_release.get_assets())
            download_url = next(
                (
                    asset.browser_download_url
                    for asset in assets
                    if asset.name.endswith(".zip")
                ),
                None,
            )
        except Exception:
            download_url = None

        rendered_plugins.append(
            {
                **plugin,
                "repo_url": repo.html_url,
                "download_url": download_url,
            }
        )

    plugin_json.write_text(json.dumps(rendered_plugins, indent=2), encoding="utf-8")
    return rendered_plugins


if __name__ == "__main__":
    generate_plugins()
