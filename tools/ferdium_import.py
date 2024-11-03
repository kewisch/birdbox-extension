# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import os
import sys
import json
import shutil

from pathlib import Path

# A big thank you to the Ferdium project for providing their recipes under the MIT license.
# This script will import the ferdium recipes into a format that works for this extension.
#
# Usage: python ferdium_import.py <path/to/ferdium-recipes>

EXCLUDE_RECIPES = {
    "google-calendar",  # This recipe uses remote script execution
    "weekplan",  # Unclear license (Apache 2 vs MIT)
    # WhatsApp includes an unnecessary remote image, but too high profile to remove
}


def gitroot():
    startpath = Path.cwd()

    if (startpath / ".git").is_dir():
        return startpath

    for path in startpath.parents:
        if (path / ".git").is_dir():
            return path.absolute()

    return None


def delete_subdirectories(directory_path):
    for item in os.listdir(directory_path):
        item_path = os.path.join(directory_path, item)
        if os.path.isdir(item_path):
            shutil.rmtree(item_path)


def read_package_json(file_path):
    """Reads the package.json file and returns its content as a dictionary."""
    with open(file_path, "r") as f:
        return json.load(f)


def is_mit(package_dir, package_data):
    if package_data.get("license") == "MIT":
        return True

    license_file = package_dir / "LICENSE"

    if not license_file.exists():
        return False

    with open(license_file, "r") as f:
        return f.read().startswith("MIT License")


def process_package_directory(package_dir, output_directory):
    """Processes a directory containing package.json and icon.svg."""
    package_json_path = package_dir / "package.json"
    icon_svg_path = package_dir / "icon.svg"

    if not os.path.exists(package_json_path):
        return None

    package_data = read_package_json(package_json_path)
    pkgid = package_data.get("id")

    if pkgid in EXCLUDE_RECIPES:
        print(f"Skipping {package_dir} because it was excluded")
        return None

    if not is_mit(package_dir, package_data):
        print(f"Skipping {package_dir} because it is not MIT licensed")
        return None

    if not package_data.get("name"):
        print(f"Skipping {package_dir} because it is lacking a service name")
        return None

    shutil.copytree(package_dir, output_directory / "recipes" / pkgid)

    return package_data


def walk_and_process_packages(root_directory, output_directory):
    """Walks through the root directory and processes each package directory."""
    packages = []
    root_directory = Path(root_directory)

    delete_subdirectories(output_directory / "recipes")

    for package_dir in root_directory.rglob("*"):
        if package_dir.is_dir() and (package_dir / "package.json").exists():
            package_info = process_package_directory(package_dir, output_directory)
            if package_info:
                packages.append(package_info)

    return packages


def write_to_json_file(output_path, data):
    """Writes the combined JSON data to a file."""
    with open(output_path, "w") as f:
        json.dump(data, f, indent=4)


def main():
    root_directory = Path(sys.argv[1]) / "recipes"
    output_directory = gitroot() / "src"

    packages_data = walk_and_process_packages(root_directory, output_directory)
    write_to_json_file(output_directory / "recipes" / "spaces.json", packages_data)


if __name__ == "__main__":
    main()
