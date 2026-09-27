"""Build the Kit Petits Pas printables (7-day guide + reward chart), FR and EN.

Usage: python3 build_kit.py <fonts_dir> <out_dir>
Needs reportlab and static Fredoka instances (Fredoka-Regular/Medium/SemiBold/Bold.ttf).
"""
import sys, os
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
                                Table, TableStyle, PageBreak, KeepTogether)

FONTS, OUT = sys.argv[1], sys.argv[2]
for n in ("Regular", "Medium", "SemiBold", "Bold"):
    pdfmetrics.registerFont(TTFont(f"Fredoka-{n}", os.path.join(FONTS, f"Fredoka-{n}.ttf")))

PINK = colors.HexColor("#E8577A"); TEAL = colors.HexColor("#2FA39A")
GREY = colors.HexColor("#464650"); SOFT = colors.HexColor("#FFF3F6"); MINT = colors.HexColor("#EAF7F5")

S = {
    "h1": ParagraphStyle("h1", fontName="Fredoka-Bold", fontSize=30, leading=36, textColor=PINK),
    "h2": ParagraphStyle("h2", fontName="Fredoka-SemiBold", fontSize=19, leading=24, textColor=TEAL, spaceBefore=6, spaceAfter=6),
    "h3": ParagraphStyle("h3", fontName="Fredoka-SemiBold", fontSize=13, leading=17, textColor=PINK, spaceBefore=6, spaceAfter=2),
    "p": ParagraphStyle("p", fontName="Fredoka-Regular", fontSize=11, leading=15.5, textColor=GREY, spaceAfter=5),
    "li": ParagraphStyle("li", fontName="Fredoka-Regular", fontSize=11, leading=15, textColor=GREY, leftIndent=14, bulletIndent=2, spaceAfter=2),
    "say": ParagraphStyle("say", fontName="Fredoka-Medium", fontSize=11.5, leading=15.5, textColor=TEAL, leftIndent=8, spaceBefore=4, spaceAfter=4),
    "small": ParagraphStyle("small", fontName="Fredoka-Regular", fontSize=8.5, leading=11.5, textColor=GREY),
    "cover": ParagraphStyle("cover", fontName="Fredoka-Medium", fontSize=15, leading=21, textColor=GREY),
}

def bullets(items):
    return [Paragraph(t, S["li"], bulletText="•") for t in items]

def box(flowables, bg):
    t = Table([[flowables]], colWidths=[6.9 * inch])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), bg), ("BOX", (0, 0), (-1, -1), 0, bg),
                           ("LEFTPADDING", (0, 0), (-1, -1), 12), ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                           ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    return t

def page_deco(footer):
    def draw(c, doc):
        c.saveState()
        c.setFillColor(PINK); c.rect(0, letter[1] - 10, letter[0], 10, fill=1, stroke=0)
        c.setFillColor(TEAL); c.rect(0, 0, letter[0], 6, fill=1, stroke=0)
        c.setFont("Fredoka-Medium", 8.5); c.setFillColor(GREY)
        c.drawString(0.8 * inch, 0.35 * inch, footer)
        c.drawRightString(letter[0] - 0.8 * inch, 0.35 * inch, str(doc.page))
        c.restoreState()
    return draw

C = {
 "fr": {
  "file": "guide-7-jours-FR.pdf",
  "footer": "CuddleNest · Kit Petits Pas · cuddlenest.ca",
  "title": "Le guide des 7 premiers jours",
  "subtitle": "L'apprentissage de la propreté, le jour, un petit pas à la fois.",
  "cover_note": "Ce guide accompagne vos culottes d'apprentissage CuddleNest. Il donne des repères "
                "simples et généraux. Chaque enfant avance à son rythme : il n'y a pas de bonne "
                "date, pas de course, et les accidents font partie du chemin.",
  "disclaimer": "Ce guide donne des conseils généraux et ne remplace pas l'avis d'un professionnel "
                "de la santé. Si vous avez un doute (douleur, constipation, recul important), "
                "parlez-en à votre médecin, à votre pédiatre ou à une infirmière (Info-Santé 811 au Québec).",
  "ready_h": "Avant de commencer : est-il prêt ?",
  "ready_p": "La plupart des enfants montrent plusieurs de ces signes avant de commencer. "
             "Pas besoin de tous les cocher.",
  "ready": ["Sa couche reste sèche pendant environ 2 heures, ou au réveil de la sieste.",
            "Il s'intéresse au pot, aux toilettes, ou veut faire « comme les grands ».",
            "Il vous montre (mots, gestes, cachette) qu'il fait pipi ou caca.",
            "Il peut baisser et remonter un pantalon avec un peu d'aide.",
            "Il comprend et suit une consigne simple : « Viens, on va au pot. »",
            "Sa couche mouillée ou sale le dérange."],
  "prep_h": "Ce qu'il vous faut",
  "prep": ["Vos culottes CuddleNest (comptez 6 à 10 paires pour une journée à la maison, avec les lavages).",
           "Un pot ou un réducteur de toilette avec un petit banc.",
           "Le tableau de récompenses (imprimé) et des autocollants.",
           "Un sac de rechange : 2 à 3 culottes, un pantalon, des lingettes, un sac pour le linge mouillé.",
           "Du temps : choisissez une période calme, sans déménagement, naissance ou rentrée le même mois."],
  "night": "<b>Pour le jour seulement.</b> Les culottes d'apprentissage protègent des petites fuites "
           "de jour. Pour la nuit, gardez une protection de nuit tant que les matins ne sont pas secs.",
  "days_h": "Jour par jour",
  "days": [
   ("Jour 1 — On se lance, en douceur",
    ["Laissez votre enfant choisir sa culotte du jour : c'est « la sienne ».",
     "Proposez le pot à des moments fixes : au réveil, après les repas, avant de sortir, avant la sieste et le bain.",
     "Entre ces moments, proposez environ toutes les 1 h 30. On propose, on ne force pas.",
     "Chaque essai compte, même sans résultat : un autocollant pour avoir essayé."],
    "« Tu veux essayer le pot avant de jouer ? »"),
   ("Jour 2 — Une routine qui rassure",
    ["Gardez les mêmes moments qu'hier : la routine aide plus que les rappels.",
     "Rendez le pot agréable : un livre, une chanson, deux ou trois minutes maximum.",
     "Montrez les étapes : baisser la culotte, s'asseoir, s'essuyer, tirer la chasse, se laver les mains."],
    "« On chante une chanson pendant que tu essaies. »"),
   ("Jour 3 — Les accidents font partie du chemin",
    ["Le 3e jour est souvent le plus difficile. C'est normal.",
     "Restez calme et neutre : pas de reproche, pas de punition.",
     "Faites-le participer : il met la culotte mouillée dans le sac et en choisit une propre.",
     "Avec une culotte d'apprentissage, il sent qu'il est mouillé : c'est comme ça qu'il fait le lien."],
    "« Oups, c'est mouillé. Le pipi va dans le pot. On se change ensemble. »"),
   ("Jour 4 — Reconnaître les signaux",
    ["Repérez ses signaux : il danse, se cache, se tient, devient soudain très calme.",
     "Nommez ce qui se passe : « Je crois que ton corps dit pipi. »",
     "Donnez-lui un mot simple pour le dire, et félicitez-le quand il l'utilise, même trop tard."],
    "« Merci de m'avoir dit pipi ! On y va vite. »"),
   ("Jour 5 — On sort de la maison",
    ["Faites une petite sortie : passage au pot juste avant de partir.",
     "Emportez le sac de rechange et, si possible, un pot de voyage.",
     "Montrez-lui où sont les toilettes dès que vous arrivez quelque part."],
    "« Avant de partir au parc, on passe au pot. »"),
   ("Jour 6 — Plus d'autonomie",
    ["Laissez-le baisser et remonter sa culotte tout seul : c'est pour ça qu'elle est comme une vraie culotte.",
     "Proposez un peu moins souvent et laissez-le vous dire quand il a envie.",
     "Félicitez l'effort et l'autonomie plus que le résultat."],
    "« Tu as remonté ta culotte tout seul ! »"),
   ("Jour 7 — On fait le bilan",
    ["Regardez le tableau ensemble et célébrez chaque autocollant.",
     "Ça avance ? Continuez la même routine. Il résiste beaucoup ? Une pause de quelques semaines, c'est correct.",
     "Si votre enfant va à la garderie, parlez de la routine avec l'éducatrice (voir page suivante)."],
    "« Regarde tous tes autocollants. Je suis tellement fier·ère de toi. »"),
  ],
  "acc_h": "Quand il y a un accident",
  "acc_do": ["Rester calme, parler doucement.", "Changer l'enfant rapidement, avec lui.",
             "Rappeler simplement où va le pipi.", "Remercier pour chaque essai."],
  "acc_dont": ["Gronder, punir ou se moquer.", "Remettre une couche « pour punir ».",
               "Comparer avec un frère, une sœur ou un ami.", "Forcer à rester longtemps sur le pot."],
  "do": "À faire", "dont": "À éviter",
  "daycare_h": "À la garderie",
  "daycare": ["Dites à l'éducatrice où vous en êtes et quels mots votre enfant utilise.",
              "Donnez 3 à 4 culottes de rechange et un pantalon, marqués à son nom, avec un sac pour le linge mouillé.",
              "Demandez-lui de suivre la même routine (au réveil de la sieste, après le dîner)."],
  "care_h": "Laver les culottes",
  "care": ["Suivez l'étiquette d'entretien de vos culottes.",
           "Rincez à l'eau froide après un accident, puis lavez avec le reste de la lessive.",
           "Évitez l'assouplissant, qui peut réduire l'absorption."],
  "pause_h": "Quand faire une pause ou demander conseil",
  "pause": ["Votre enfant pleure, se retient ou refuse fortement le pot plusieurs jours de suite : faites une pause de 2 à 4 semaines.",
            "Un grand changement arrive (bébé, déménagement, nouvelle garderie) : les reculs sont fréquents, reprenez plus tard.",
            "Douleur, brûlure, constipation, ou recul qui dure : parlez-en à un professionnel de la santé."],
  "end": "Des questions ? Écrivez-nous : brouinc@yahoo.com · cuddlenest.ca<br/>Petits pas, grandes étapes.",
  "chart_file": "tableau-recompenses-FR.pdf",
  "chart_title": "Mon tableau des petits pas",
  "chart_name": "Prénom : ______________________",
  "chart_cols": ["", "Matin", "Midi", "Après-midi", "Soir", "Bravo !"],
  "chart_days": ["Jour 1", "Jour 2", "Jour 3", "Jour 4", "Jour 5", "Jour 6", "Jour 7"],
  "chart_help": "Un autocollant ou une étoile coloriée pour chaque essai au pot. Tout compte, même un essai sans pipi !",
 },
 "en": {
  "file": "guide-7-days-EN.pdf",
  "footer": "CuddleNest · Small Steps Kit · cuddlenest.ca",
  "title": "Your first 7 days guide",
  "subtitle": "Daytime potty training, one small step at a time.",
  "cover_note": "This guide comes with your CuddleNest training pants. It gives simple, general "
                "pointers. Every child learns at their own pace: there is no right date, no race, "
                "and accidents are part of the journey.",
  "disclaimer": "This guide offers general tips and does not replace advice from a health "
                "professional. If you have concerns (pain, constipation, a big step back), talk to "
                "your doctor, paediatrician or a nurse (811 health line in most provinces).",
  "ready_h": "Before you start: are they ready?",
  "ready_p": "Most children show several of these signs before starting. They don't need all of them.",
  "ready": ["Their diaper stays dry for about 2 hours, or after a nap.",
            "They're curious about the potty or the toilet, or want to do it \"like the big kids\".",
            "They show you (words, gestures, hiding) when they pee or poop.",
            "They can pull pants down and up with a little help.",
            "They understand and follow a simple instruction: \"Let's go to the potty.\"",
            "A wet or dirty diaper bothers them."],
  "prep_h": "What you'll need",
  "prep": ["Your CuddleNest pants (plan 6 to 10 pairs for a day at home, with laundry).",
           "A potty, or a toilet seat reducer with a small step stool.",
           "The printed reward chart and some stickers.",
           "A change bag: 2 to 3 pants, spare trousers, wipes, a bag for wet clothes.",
           "Time: pick a calm period, not the same month as a move, a new baby or a new daycare."],
  "night": "<b>Daytime only.</b> Training pants protect against small daytime leaks. Keep overnight "
           "protection until mornings are dry.",
  "days_h": "Day by day",
  "days": [
   ("Day 1 — Gently getting started",
    ["Let your child pick today's pants: they're \"theirs\".",
     "Offer the potty at set times: on waking, after meals, before going out, before nap and bath.",
     "In between, offer about every 90 minutes. Offer, never force.",
     "Every try counts, even without a result: one sticker for trying."],
    "\"Want to try the potty before we play?\""),
   ("Day 2 — A routine that reassures",
    ["Keep the same times as yesterday: routine helps more than reminders.",
     "Make potty time pleasant: a book, a song, two or three minutes at most.",
     "Show the steps: pants down, sit, wipe, flush, wash hands."],
    "\"Let's sing a song while you try.\""),
   ("Day 3 — Accidents are part of the journey",
    ["Day 3 is often the hardest. That's normal.",
     "Stay calm and neutral: no blame, no punishment.",
     "Get them involved: they put the wet pants in the bag and choose a clean pair.",
     "Training pants let them feel wet: that's how they make the connection."],
    "\"Oops, it's wet. Pee goes in the potty. Let's change together.\""),
   ("Day 4 — Spotting the signals",
    ["Watch for their signals: dancing, hiding, holding, suddenly going quiet.",
     "Name what's happening: \"I think your body is saying pee.\"",
     "Give them a simple word to say it, and praise them when they use it, even if it's too late."],
    "\"Thank you for telling me! Let's go quickly.\""),
   ("Day 5 — Leaving the house",
    ["Go on a short outing: potty stop right before you leave.",
     "Bring the change bag and, if you can, a travel potty.",
     "Show them where the toilets are as soon as you arrive somewhere."],
    "\"Before we go to the park, potty stop.\""),
   ("Day 6 — More independence",
    ["Let them pull their pants down and up on their own: that's why they're like real underwear.",
     "Offer a little less often and let them tell you when they need to go.",
     "Praise effort and independence more than results."],
    "\"You pulled up your pants all by yourself!\""),
   ("Day 7 — Looking back",
    ["Look at the chart together and celebrate every sticker.",
     "Going well? Keep the same routine. Strong resistance? A break of a few weeks is fine.",
     "If your child goes to daycare, share the routine with the educator (see next page)."],
    "\"Look at all your stickers. I'm so proud of you.\""),
  ],
  "acc_h": "When there's an accident",
  "acc_do": ["Stay calm, speak softly.", "Change them quickly, together.",
             "Simply remind them where pee goes.", "Thank them for every try."],
  "acc_dont": ["Scold, punish or tease.", "Put a diaper back on \"as a punishment\".",
               "Compare with a sibling or a friend.", "Make them sit on the potty for a long time."],
  "do": "Do", "dont": "Avoid",
  "daycare_h": "At daycare",
  "daycare": ["Tell the educator where you're at and which words your child uses.",
              "Send 3 to 4 spare pants and trousers, labelled with their name, plus a wet bag.",
              "Ask them to follow the same routine (after nap, after lunch)."],
  "care_h": "Washing the pants",
  "care": ["Follow the care label on your pants.",
           "Rinse in cold water after an accident, then wash with the rest of your laundry.",
           "Skip fabric softener, which can reduce absorbency."],
  "pause_h": "When to take a break or ask for advice",
  "pause": ["Your child cries, holds it in or strongly refuses the potty several days in a row: take a 2 to 4 week break.",
            "A big change is coming (new baby, move, new daycare): setbacks are common, try again later.",
            "Pain, burning, constipation, or a setback that lasts: talk to a health professional."],
  "end": "Questions? Email us: brouinc@yahoo.com · cuddlenest.ca<br/>Small steps, big milestones.",
  "chart_file": "reward-chart-EN.pdf",
  "chart_title": "My small steps chart",
  "chart_name": "Name: ______________________",
  "chart_cols": ["", "Morning", "Noon", "Afternoon", "Evening", "Hooray!"],
  "chart_days": ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"],
  "chart_help": "One sticker or a coloured star for every potty try. Everything counts, even a try with no pee!",
 },
}

def build_guide(t):
    doc = BaseDocTemplate(os.path.join(OUT, t["file"]), pagesize=letter, title=t["title"],
                          author="CuddleNest", leftMargin=0.8*inch, rightMargin=0.8*inch,
                          topMargin=0.8*inch, bottomMargin=0.7*inch)
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="f")
    doc.addPageTemplates([PageTemplate(id="p", frames=[frame], onPage=page_deco(t["footer"]))])
    st = []
    # cover
    st += [Spacer(1, 1.3*inch),
           Paragraph('<font color="#E8577A">Cuddle</font><font color="#2FA39A">Nest</font>',
                     ParagraphStyle("brand", parent=S["h1"], fontSize=44, leading=52)),
           Spacer(1, 0.25*inch), Paragraph(t["title"], S["h1"]), Spacer(1, 0.1*inch),
           Paragraph(t["subtitle"], S["cover"]), Spacer(1, 0.4*inch),
           box([Paragraph(t["cover_note"], S["p"])], SOFT), Spacer(1, 0.25*inch),
           box([Paragraph(t["night"], S["p"])], MINT), Spacer(1, 1.2*inch),
           Paragraph(t["disclaimer"], S["small"]), PageBreak()]
    # readiness + prep
    st += [Paragraph(t["ready_h"], S["h2"]), Paragraph(t["ready_p"], S["p"])]
    st += [Paragraph(x, S["li"], bulletText="•") for x in t["ready"]]
    st += [Spacer(1, 10), Paragraph(t["prep_h"], S["h2"])] + bullets(t["prep"]) + [PageBreak()]
    # days
    st.append(Paragraph(t["days_h"], S["h2"]))
    for i, (h, tips, say) in enumerate(t["days"]):
        block = [Paragraph(h, S["h3"])] + bullets(tips) + [Paragraph(say, S["say"])]
        st.append(KeepTogether([box(block, SOFT if i % 2 == 0 else MINT), Spacer(1, 8)]))
    st.append(PageBreak())
    # accidents, daycare, care, pause
    col = lambda title, items, c: [Paragraph(title, ParagraphStyle("c", parent=S["h3"], textColor=c))] + bullets(items)
    tbl = Table([[col(t["do"], t["acc_do"], TEAL), col(t["dont"], t["acc_dont"], PINK)]], colWidths=[3.4*inch, 3.4*inch])
    tbl.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("BACKGROUND", (0, 0), (0, 0), MINT),
                             ("BACKGROUND", (1, 0), (1, 0), SOFT), ("LEFTPADDING", (0, 0), (-1, -1), 10),
                             ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    st += [Paragraph(t["acc_h"], S["h2"]), tbl, Spacer(1, 8),
           Paragraph(t["daycare_h"], S["h2"])] + bullets(t["daycare"])
    st += [Paragraph(t["care_h"], S["h2"])] + bullets(t["care"])
    st += [Paragraph(t["pause_h"], S["h2"])] + bullets(t["pause"])
    st += [Spacer(1, 14), box([Paragraph(t["end"], ParagraphStyle("e", parent=S["p"], fontName="Fredoka-Medium", alignment=1))], SOFT)]
    doc.build(st)

def star(c, cx, cy, r, stroke):
    import math
    pts = []
    for i in range(10):
        a = math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.45
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    p = c.beginPath(); p.moveTo(*pts[0])
    for q in pts[1:]: p.lineTo(*q)
    p.close(); c.setStrokeColor(stroke); c.setLineWidth(1.4); c.drawPath(p, stroke=1, fill=0)

def build_chart(t):
    from reportlab.lib.pagesizes import landscape
    from reportlab.pdfgen import canvas
    W, H = landscape(letter)
    c = canvas.Canvas(os.path.join(OUT, t["chart_file"]), pagesize=(W, H))
    c.setTitle(t["chart_title"]); c.setAuthor("CuddleNest")
    c.setFillColor(SOFT); c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(PINK); c.setFont("Fredoka-Bold", 30); c.drawCentredString(W/2, H-0.85*inch, t["chart_title"])
    c.setFillColor(GREY); c.setFont("Fredoka-Medium", 15); c.drawCentredString(W/2, H-1.25*inch, t["chart_name"])
    cols = t["chart_cols"]; rows = t["chart_days"]
    x0, y0 = 0.6*inch, 0.95*inch; gw, gh = W - 1.2*inch, H - 2.55*inch
    cw = [1.35*inch] + [(gw - 1.35*inch) / 5] * 5
    rh = gh / (len(rows) + 1)
    y = y0 + gh
    for ri in range(len(rows) + 1):
        x = x0
        for ci, w in enumerate(cw):
            fill = colors.white if ri else (TEAL if ci else colors.white)
            if ri and ci == 5: fill = colors.HexColor("#FFE3EA")
            c.setFillColor(fill); c.setStrokeColor(colors.HexColor("#F2C4D0")); c.setLineWidth(1)
            c.roundRect(x + 2, y - rh + 2, w - 4, rh - 4, 8, fill=1, stroke=1)
            if ri == 0 and ci:
                c.setFillColor(colors.white); c.setFont("Fredoka-SemiBold", 14)
                c.drawCentredString(x + w/2, y - rh/2 - 5, cols[ci])
            elif ri and ci == 0:
                c.setFillColor(PINK); c.setFont("Fredoka-SemiBold", 15)
                c.drawCentredString(x + w/2, y - rh/2 - 5, rows[ri-1])
            elif ri:
                star(c, x + w/2, y - rh/2, min(w, rh) * 0.28, PINK if ci == 5 else TEAL)
            x += w
        y -= rh
    c.setFillColor(GREY); c.setFont("Fredoka-Regular", 11.5)
    c.drawCentredString(W/2, 0.55*inch, t["chart_help"])
    c.setFont("Fredoka-Medium", 9); c.drawRightString(W - 0.6*inch, 0.3*inch, "cuddlenest.ca")
    c.showPage(); c.save()

os.makedirs(OUT, exist_ok=True)
for lang in ("fr", "en"):
    build_guide(C[lang]); build_chart(C[lang])
print("done")
