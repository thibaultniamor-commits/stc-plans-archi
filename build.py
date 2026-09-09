# -*- coding: utf-8 -*-
"""Assemble index.html — l'outil complet en un seul fichier, utilisable hors ligne.

Prend src/outil_stc.src.html et y injecte, en base64, pdf.js + son worker et
PptxGenJS (dossier vendor/), plus les règles STC. À relancer après toute
modification de la source ou de regles_stc.json :

    python build.py
"""
import base64
import os

ICI = os.path.dirname(os.path.abspath(__file__))


def construire():
    src = open(os.path.join(ICI, "src", "outil_stc.src.html"), encoding="utf-8").read()
    pdfjs = open(os.path.join(ICI, "vendor", "pdf.min.js"), "rb").read()
    worker = open(os.path.join(ICI, "vendor", "pdf.worker.min.js"), "rb").read()
    pptx = open(os.path.join(ICI, "vendor", "pptxgen.bundle.min.js"), "rb").read()
    regles = open(os.path.join(ICI, "regles_stc.json"), encoding="utf-8").read()

    out = (src.replace("__REGLES__", regles.replace("</", "<\\/"))
              .replace("__PDFJS_B64__", base64.b64encode(pdfjs).decode())
              .replace("__WORKER_B64__", base64.b64encode(worker).decode())
              .replace("__PPTX_B64__", base64.b64encode(pptx).decode()))

    for marque in ("__REGLES__", "__PDFJS_B64__", "__WORKER_B64__", "__PPTX_B64__"):
        assert marque not in out, "marque non remplacée : " + marque

    dest = os.path.join(ICI, "index.html")
    with open(dest, "w", encoding="utf-8") as f:
        f.write(out)
    print("OK : {} ({:.1f} Mo)".format(dest, len(out) / 1e6))


if __name__ == "__main__":
    construire()
