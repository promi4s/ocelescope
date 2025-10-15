import argparse
from ocelescope.tools.build import main as build_plugins


def main():
    parser = argparse.ArgumentParser()

    args = parser.parse_args()

    if args.cmd == "build":
        build_plugins()
