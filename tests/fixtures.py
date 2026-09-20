# -*- coding: utf-8 -*-
"""Plans d'essai synthetiques : un meme batiment de 30 x 18 m en DXF (mm et m),
SVG, PDF vectoriel, PDF scanne et image PNG. Ecrits dans tests/fx/, qui n'est pas
versionne. Sert au banc headless — aucun plan reel ne doit atterrir la.

    python tests/fixtures.py

Demande PyMuPDF (`pip install pymupdf`) pour les deux PDF et l'image."""
import math
import os

ICI = os.path.dirname(os.path.abspath(__file__))

# batiment de 30 m x 18 m, trame de 6 x 3 locaux, murs en double trait (0,15 m)
LARG, HAUT = 30.0, 18.0
NX, NY = 6, 3
EP = 0.15
NOMS = ["101 BUREAU", "102 BUREAU", "103 SALLE DE REUNION", "104 BUREAU",
        "105 LOCAL TECHNIQUE", "106 BUREAU", "107 OPEN SPACE", "108 BUREAU",
        "109 SANITAIRES", "110 BUREAU", "111 SALLE DE REUNION", "112 BUREAU",
        "113 CIRCULATION", "114 BUREAU", "115 ARCHIVES", "116 BUREAU",
        "117 BUREAU", "118 CAFETERIA"]


def murs():
    """Renvoie les segments de mur (double trait) en metres, repere Y vers le haut."""
    out = []
    dx, dy = LARG / NX, HAUT / NY
    for i in range(NX + 1):                       # refends verticaux
        x = i * dx
        for o in (-EP / 2, EP / 2):
            out.append((x + o, 0.0, x + o, HAUT))
    for j in range(NY + 1):                       # refends horizontaux
        y = j * dy
        for o in (-EP / 2, EP / 2):
            out.append((0.0, y + o, LARG, y + o))
    return out


def portes():
    """Une porte par local, sur le refend horizontal du bas : centre, rayon."""
    out = []
    dx, dy = LARG / NX, HAUT / NY
    for j in range(NY):
        for i in range(NX):
            out.append((i * dx + dx * 0.25, j * dy + EP / 2, 0.9))
    return out


def mobilier():
    """Du bruit sur un calque a ignorer : des bureaux rectangulaires."""
    out = []
    dx, dy = LARG / NX, HAUT / NY
    for j in range(NY):
        for i in range(NX):
            cx, cy = i * dx + dx * 0.65, j * dy + dy * 0.5
            out += [(cx - 0.8, cy - 0.4, cx + 0.8, cy - 0.4),
                    (cx + 0.8, cy - 0.4, cx + 0.8, cy + 0.4),
                    (cx + 0.8, cy + 0.4, cx - 0.8, cy + 0.4),
                    (cx - 0.8, cy + 0.4, cx - 0.8, cy - 0.4)]
    return out


def libelles():
    dx, dy = LARG / NX, HAUT / NY
    out = []
    k = 0
    for j in range(NY):
        for i in range(NX):
            out.append((i * dx + dx * 0.5, j * dy + dy * 0.75, NOMS[k % len(NOMS)]))
            k += 1
    return out


# ------------------------------------------------------------------ DXF
def ecrire_dxf(chemin, unites_mm=True):
    k = 1000.0 if unites_mm else 1.0
    o = []
    def w(c, v):
        o.append(str(c)); o.append(str(v))
    w(0, "SECTION"); w(2, "HEADER")
    w(9, "$INSUNITS"); w(70, 4 if unites_mm else 6)
    w(0, "ENDSEC")
    w(0, "SECTION"); w(2, "TABLES")
    w(0, "TABLE"); w(2, "LAYER")
    for nom, col in (("MUR", 7), ("PORTE", 3), ("MOBILIER", 8), ("A-TEXTE", 2)):
        w(0, "LAYER"); w(2, nom); w(70, 0); w(62, col); w(6, "CONTINUOUS")
    w(0, "ENDTAB"); w(0, "ENDSEC")
    w(0, "SECTION"); w(2, "ENTITIES")
    for x1, y1, x2, y2 in murs():
        w(0, "LINE"); w(8, "MUR")
        w(10, x1 * k); w(20, y1 * k); w(11, x2 * k); w(21, y2 * k)
    for cx, cy, r in portes():
        w(0, "ARC"); w(8, "PORTE")
        w(10, cx * k); w(20, cy * k); w(40, r * k); w(50, 0); w(51, 90)
        w(0, "LINE"); w(8, "PORTE")
        w(10, cx * k); w(20, cy * k); w(11, (cx + r) * k); w(21, cy * k)
    for x1, y1, x2, y2 in mobilier():
        w(0, "LINE"); w(8, "MOBILIER")
        w(10, x1 * k); w(20, y1 * k); w(11, x2 * k); w(21, y2 * k)
    for x, y, s in libelles():
        w(0, "TEXT"); w(8, "A-TEXTE")
        w(10, x * k); w(20, y * k); w(40, 0.3 * k); w(1, s); w(72, 1); w(11, x * k); w(21, y * k)
    w(0, "ENDSEC"); w(0, "EOF")
    open(chemin, "wb").write(("\r\n".join(o) + "\r\n").encode("utf-8"))


# ------------------------------------------------------------------ SVG
PT_M = 72 / 25.4 * 1000 / 100          # 1 m a l'echelle 1/100, en points


def ecrire_svg(chemin):
    W, H = LARG * PT_M, HAUT * PT_M
    X = lambda x: round(x * PT_M, 2)
    Y = lambda y: round((HAUT - y) * PT_M, 2)
    p = ['<?xml version="1.0" encoding="UTF-8"?>',
         '<svg xmlns="http://www.w3.org/2000/svg" width="%.2fpt" height="%.2fpt" '
         'viewBox="0 0 %.2f %.2f">' % (W, H, W, H),
         '<rect x="0" y="0" width="%.2f" height="%.2f" fill="#fff"/>' % (W, H),
         '<g stroke="#000" fill="none" stroke-width="1.2">']
    for x1, y1, x2, y2 in murs():
        p.append('<line x1="%s" y1="%s" x2="%s" y2="%s"/>' % (X(x1), Y(y1), X(x2), Y(y2)))
    p.append('</g><g stroke="#444" fill="none" stroke-width="0.25">')
    for x1, y1, x2, y2 in mobilier():
        p.append('<line x1="%s" y1="%s" x2="%s" y2="%s"/>' % (X(x1), Y(y1), X(x2), Y(y2)))
    for cx, cy, r in portes():                    # arc de porte en polyligne
        pts = " ".join("%s,%s" % (X(cx + r * math.cos(a * math.pi / 180)),
                                  Y(cy + r * math.sin(a * math.pi / 180)))
                       for a in range(0, 95, 5))
        p.append('<polyline points="%s"/>' % pts)
    p.append('</g><g font-family="sans-serif" font-size="8" fill="#000" text-anchor="middle">')
    for x, y, s in libelles():
        p.append('<text x="%s" y="%s">%s</text>' % (X(x), Y(y), s))
    p.append('</g></svg>')
    open(chemin, "w", encoding="utf-8").write("\n".join(p))


# ------------------------------------------------------------------ PDF
def ecrire_pdf(chemin, scanne=False):
    import fitz
    W, H = LARG * PT_M + 40, HAUT * PT_M + 40
    doc = fitz.open()
    page = doc.new_page(width=W, height=H)
    X = lambda x: 20 + x * PT_M
    Y = lambda y: 20 + (HAUT - y) * PT_M
    for x1, y1, x2, y2 in murs():
        page.draw_line(fitz.Point(X(x1), Y(y1)), fitz.Point(X(x2), Y(y2)),
                       color=(0, 0, 0), width=1.2)
    for x1, y1, x2, y2 in mobilier():
        page.draw_line(fitz.Point(X(x1), Y(y1)), fitz.Point(X(x2), Y(y2)),
                       color=(.3, .3, .3), width=0.25)
    for cx, cy, r in portes():
        pts = [fitz.Point(X(cx + r * math.cos(a * math.pi / 180)),
                          Y(cy + r * math.sin(a * math.pi / 180)))
               for a in range(0, 95, 5)]
        for a, b in zip(pts, pts[1:]):
            page.draw_line(a, b, color=(.3, .3, .3), width=0.25)
    for x, y, s in libelles():
        page.insert_text(fitz.Point(X(x) - len(s) * 2.2, Y(y)), s, fontsize=8)
    if scanne:
        pix = page.get_pixmap(dpi=110)
        doc2 = fitz.open()
        p2 = doc2.new_page(width=W, height=H)
        p2.insert_image(fitz.Rect(0, 0, W, H), pixmap=pix)
        doc2.save(chemin); doc2.close()
    else:
        doc.save(chemin)
    doc.close()


def murs_poche():
    """Les memes murs, en barreaux pleins : (x0, y0, x1, y1) en metres."""
    out = []
    dx, dy = LARG / NX, HAUT / NY
    for i in range(NX + 1):
        x = i * dx
        out.append((x - EP / 2, 0.0, x + EP / 2, HAUT))
    for j in range(NY + 1):
        y = j * dy
        out.append((0.0, y - EP / 2, LARG, y + EP / 2))
    return out


def ecrire_pdf_poche(chemin, echelle=100):
    """Plan dont les murs sont poches — remplis, sans aucun contour au trait.

    C'est le cas qui sortait vide : le moteur ne lisait que les traits. L'echelle
    est parametrable, pour eprouver la deduction d'echelle par les battants — et,
    depuis le point 7 du carnet, pour que le meme batiment se retrouve au releve
    quelle que soit l'echelle a laquelle il est dessine. Pour que ce soit bien le
    meme dessin, la marge de feuille se prend en metres (0,7 m de plan) et le
    lettrage en points (8 pt de papier, comme sur un vrai plan)."""
    import fitz
    pt_m = 72 / 25.4 * 1000 / echelle
    marge = 0.7 * pt_m
    W, H = LARG * pt_m + 2 * marge, HAUT * pt_m + 2 * marge
    doc = fitz.open()
    page = doc.new_page(width=W, height=H)
    X = lambda x: marge + x * pt_m
    Y = lambda y: marge + (HAUT - y) * pt_m
    for x0, y0, x1, y1 in murs_poche():
        page.draw_rect(fitz.Rect(X(x0), Y(y1), X(x1), Y(y0)),
                       color=None, fill=(0, 0, 0))
    for x1, y1, x2, y2 in mobilier():
        page.draw_line(fitz.Point(X(x1), Y(y1)), fitz.Point(X(x2), Y(y2)),
                       color=(.3, .3, .3), width=0.25)
    # le battant en une seule polyligne : c'est ce qui permet d'en mesurer le
    # rayon, donc de retrouver l'echelle du plan
    for cx, cy, r in portes():
        pts = [fitz.Point(X(cx + r * math.cos(a * math.pi / 180)),
                          Y(cy + r * math.sin(a * math.pi / 180)))
               for a in range(0, 95, 5)]
        page.draw_polyline(pts, color=(.3, .3, .3), width=0.25)
        page.draw_line(fitz.Point(X(cx), Y(cy)),
                       fitz.Point(X(cx + r), Y(cy)), color=(.3, .3, .3), width=0.25)
    for x, y, s in libelles():
        page.insert_text(fitz.Point(X(x) - len(s) * 2.2, Y(y)), s, fontsize=8)
    page.insert_text(fitz.Point(W - 90, H - 12), "1 : %d" % echelle, fontsize=8)
    doc.save(chemin)
    doc.close()


# ------------------------------------------------- plan a cloison en biais
# Le point 6 du carnet : une cloison qui n'est ni horizontale ni verticale
# ressortait en marches d'escalier, projetee sur l'axe dominant. Le batiment est
# ici reduit au minimum — un rectangle coupe en deux par un refend oblique — pour
# que la cloison mesuree soit celle-la et aucune autre.
BIAIS_L, BIAIS_H = 20.0, 12.0
BIAIS_A = (7.0, 0.0)                   # le refend va de A en bas...
BIAIS_B = (13.0, 12.0)                 # ... a B en haut : 26,6 degres de la verticale


def murs_biais():
    """Le pourtour et le refend oblique, en double trait (0,15 m)."""
    out = []
    for o in (-EP / 2, EP / 2):
        out += [(0.0, o, BIAIS_L, o), (0.0, BIAIS_H + o, BIAIS_L, BIAIS_H + o),
                (o, 0.0, o, BIAIS_H), (BIAIS_L + o, 0.0, BIAIS_L + o, BIAIS_H)]
    (ax, ay), (bx, by) = BIAIS_A, BIAIS_B
    L = math.hypot(bx - ax, by - ay)
    nx, ny = (by - ay) / L, -(bx - ax) / L          # normale au refend
    for o in (-EP / 2, EP / 2):
        out.append((ax + nx * o, ay + ny * o, bx + nx * o, by + ny * o))
    return out


def ecrire_pdf_biais(chemin, echelle=100):
    import fitz
    pt_m = 72 / 25.4 * 1000 / echelle
    W, H = BIAIS_L * pt_m + 40, BIAIS_H * pt_m + 40
    doc = fitz.open()
    page = doc.new_page(width=W, height=H)
    X = lambda x: 20 + x * pt_m
    Y = lambda y: 20 + (BIAIS_H - y) * pt_m
    for x1, y1, x2, y2 in murs_biais():
        page.draw_line(fitz.Point(X(x1), Y(y1)), fitz.Point(X(x2), Y(y2)),
                       color=(0, 0, 0), width=1.2)
    for x, y, s in [(3.5, 6.0, "201 BUREAU"), (16.0, 6.0, "202 SALLE DE REUNION")]:
        page.insert_text(fitz.Point(X(x) - len(s) * 2.2, Y(y)), s,
                         fontsize=8 * 100 / echelle)
    doc.save(chemin)
    doc.close()


def ecrire_png(chemin):
    import fitz
    tmp = os.path.join(ICI, "_tmp_plan.pdf")
    ecrire_pdf(tmp)
    doc = fitz.open(tmp)
    doc[0].get_pixmap(dpi=120).save(chemin)
    doc.close(); os.remove(tmp)


if __name__ == "__main__":
    d = os.path.join(ICI, "fx")
    os.makedirs(d, exist_ok=True)
    ecrire_dxf(os.path.join(d, "plan.dxf"))
    ecrire_dxf(os.path.join(d, "plan_metres.dxf"), unites_mm=False)
    ecrire_svg(os.path.join(d, "plan.svg"))
    ecrire_pdf(os.path.join(d, "plan.pdf"))
    ecrire_pdf(os.path.join(d, "plan_scan.pdf"), scanne=True)
    ecrire_pdf_poche(os.path.join(d, "plan_poche.pdf"))
    ecrire_pdf_poche(os.path.join(d, "plan_poche_50.pdf"), echelle=50)
    ecrire_pdf_poche(os.path.join(d, "plan_poche_200.pdf"), echelle=200)
    ecrire_pdf_biais(os.path.join(d, "plan_biais.pdf"))
    ecrire_png(os.path.join(d, "plan.png"))
    for f in sorted(os.listdir(d)):
        print(f, os.path.getsize(os.path.join(d, f)))
