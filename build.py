# -*- coding: utf-8 -*-
"""Assemble index.html — l'outil complet en un seul fichier, utilisable hors ligne.

Prend src/outil_stc.src.html et y injecte, en base64, pdf.js + son worker et
PptxGenJS (dossier vendor/), plus les règles STC et le numéro de version lu
dans VERSION. À relancer après toute modification de la source, de
regles_stc.json ou de VERSION :

    python build.py
"""
import base64
import os
import re

ICI = os.path.dirname(os.path.abspath(__file__))

MARQUES = ("__REGLES__", "__PDFJS_B64__", "__WORKER_B64__", "__PPTX_B64__",
           "__VERSION__")


def version():
    """Numéro de version de l'outil — source unique, le fichier VERSION."""
    v = open(os.path.join(ICI, "VERSION"), encoding="utf-8").read().strip()
    if not re.match(r"^\d+\.\d+\.\d+$", v):
        raise SystemExit("VERSION doit tenir en MAJEUR.MINEUR.CORRECTIF : " + v)
    return v


def construire():
    src = open(os.path.join(ICI, "src", "outil_stc.src.html"), encoding="utf-8").read()
    pdfjs = open(os.path.join(ICI, "vendor", "pdf.min.js"), "rb").read()
    worker = open(os.path.join(ICI, "vendor", "pdf.worker.min.js"), "rb").read()
    pptx = open(os.path.join(ICI, "vendor", "pptxgen.bundle.min.js"), "rb").read()
    regles = open(os.path.join(ICI, "regles_stc.json"), encoding="utf-8").read()
    v = version()

    out = (src.replace("__REGLES__", regles.replace("</", "<\\/"))
              .replace("__VERSION__", v)
              .replace("__PDFJS_B64__", base64.b64encode(pdfjs).decode())
              .replace("__WORKER_B64__", base64.b64encode(worker).decode())
              .replace("__PPTX_B64__", base64.b64encode(pptx).decode()))

    for marque in MARQUES:
        assert marque not in out, "marque non remplacée : " + marque

    dest = os.path.join(ICI, "index.html")
    with open(dest, "w", encoding="utf-8") as f:
        f.write(out)
    print("OK : {} — v{} ({:.1f} Mo)".format(dest, v, len(out) / 1e6))


if __name__ == "__main__":
    construire()
