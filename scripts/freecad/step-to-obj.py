"""Tessellate a STEP file to OBJ using FreeCAD's bundled Python runtime."""

import os

import FreeCAD
import MeshPart
import Part


def main():
    source = os.environ.get("MINILAB_STEP_SOURCE")
    output = os.environ.get("MINILAB_OBJ_OUTPUT")
    if not source or not output:
        raise SystemExit(
            "MINILAB_STEP_SOURCE and MINILAB_OBJ_OUTPUT must be set"
        )
    shape = Part.Shape()
    shape.read(source)
    if shape.isNull():
        raise RuntimeError(f"FreeCAD could not read {source}")

    mesh = MeshPart.meshFromShape(
        Shape=shape,
        LinearDeflection=0.2,
        AngularDeflection=0.35,
        Relative=False,
    )
    mesh.write(output)
    FreeCAD.Console.PrintMessage(f"Wrote {output}\n")


if __name__ == "__main__":
    main()
