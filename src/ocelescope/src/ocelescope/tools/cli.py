import argparse
from ocelescope.tools.build import build_plugins


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd")
    sub.add_parser("build", help="Build Ocelescope Plugins")

    args = parser.parse_args()

    if args.cmd == "build":
        build_plugins()
