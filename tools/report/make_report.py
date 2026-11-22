#!/usr/bin/env python3
"""보고서 원고(.txt) → 학교장 보고서 양식 hwpx.

    python3 tools/report/make_report.py 원고.txt -o "documents/○○ 보고.hwpx" [--register] [--ver v2] [--note "…"]

원고 문법은 .claude/skills/report/SKILL.md 4절. 표준 라이브러리만 쓴다.
"""
import argparse, datetime, json, os, re, sys, zipfile
from xml.sax.saxutils import escape

XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>'
NS = ('xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" '
      'xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" '
      'xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" '
      'xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" '
      'xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" xmlns:dc="http://purl.org/dc/elements/1.1/" '
      'xmlns:opf="http://www.idpf.org/2007/opf/" xmlns:ooxmlchart="http://www.hancom.co.kr/hwpml/2016/ooxmlchart" '
      'xmlns:hwpunitchar="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar" xmlns:epub="http://www.idpf.org/2007/ops" '
      'xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"')
LANGS = ['hangul', 'latin', 'hanja', 'japanese', 'other', 'symbol', 'user']
FONTS = ['함초롬돋움', '함초롬바탕', 'HY헤드라인M', '휴먼명조', '맑은 고딕']
F_DOT, F_BAT, F_HEAD, F_BODY, F_GOTHIC = range(5)

MM = 7200 / 25.4
PAGE_W, PAGE_H = 59528, 84188
MARGIN_LR = round(20 * MM)
TEXT_W = PAGE_W - 2 * MARGIN_LR - 300   # 표 오른쪽 선이 여백에 걸리지 않게

NAVY, BLUE, RED, GRAY = '#1f3864', '#0000ff', '#c00000', '#7f7f7f'
FILL_TITLE, FILL_HEAD, FILL_BOX, FILL_FIG, YELLOW = '#dbe5f1', '#dfe6f7', '#f2f2f2', '#fafafa', '#ffff00'
ROMAN = 'ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ'


def allv(v):
    return ' '.join(f'{l}="{v}"' for l in LANGS)


class Registry:
    """같은 속성은 같은 id 를 돌려주는 목록 (charPr · paraPr · borderFill)."""

    def __init__(self, start=0):
        self.items, self.start = {}, start

    def get(self, key):
        if key not in self.items:
            self.items[key] = self.start + len(self.items)
        return self.items[key]


class Doc:
    def __init__(self):
        self.cp, self.pp, self.bf = Registry(), Registry(), Registry(1)
        self.bf.get(('NONE', '0.1 mm', '#000000') * 4 + (None,))        # 1: 쪽 테두리
        self.bf.get(('NONE', '0.1 mm', '#000000') * 4 + ('none',))      # 2: 글자 · 문단 기본
        self.char(), self.para()                                        # id 0
        self.body, self.plain, self.pid = [], [], 0

    # ----- 모양 -----
    def char(self, size=10, font=F_BAT, bold=False, under=False, color='#000000', shade='none'):
        return self.cp.get((int(size * 100), font, bold, under, color, shade))

    def para(self, align='JUSTIFY', left=0, indent=0, prev=0, nxt=0, ls=160, keep=False):
        return self.pp.get((align, left, indent, prev, nxt, ls, keep))

    def border(self, l='SOLID', r='SOLID', t='SOLID', b='SOLID', fill=None, w='0.12 mm', color='#000000', wt=None, wb=None):
        side = lambda ty, wd=None: (ty, wd or w, color)
        return self.bf.get(side(l) + side(r) + side(t, wt) + side(b, wb) + (fill,))

    # ----- 글 -----
    def runs(self, text, size, font, color='#000000', bold=False):
        """**굵게**  __밑줄__  ==형광==  {{파랑}} 을 run 으로 나눈다."""
        out, plain = [], []
        for tok in re.split(r'(\*\*.+?\*\*|__.+?__|==.+?==|\{\{.+?\}\})', text):
            if not tok:
                continue
            kw = dict(size=size, font=font, color=color, bold=bold)
            if tok.startswith('**') and tok.endswith('**') and len(tok) > 4:
                tok, kw['bold'] = tok[2:-2], True
            elif tok.startswith('__') and tok.endswith('__') and len(tok) > 4:
                tok, kw['under'], kw['bold'] = tok[2:-2], True, True
            elif tok.startswith('==') and tok.endswith('==') and len(tok) > 4:
                tok, kw['shade'], kw['bold'] = tok[2:-2], YELLOW, True
            elif tok.startswith('{{') and tok.endswith('}}'):
                tok, kw['color'], kw['bold'] = tok[2:-2], BLUE, True
            for part in re.split(r'(확인 필요)', tok):       # 빈 숫자는 눈에 띄게
                if not part:
                    continue
                k2 = dict(kw, shade=YELLOW, color=RED) if part == '확인 필요' else kw
                out.append(f'<hp:run charPrIDRef="{self.char(**k2)}"><hp:t>{escape(part)}</hp:t></hp:run>')
                plain.append(part)
        return ''.join(out) or f'<hp:run charPrIDRef="{self.char(size, font)}"><hp:t/></hp:run>', ''.join(plain)

    def p(self, inner, pp=0, page_break=False):
        self.pid += 1
        return (f'<hp:p id="{self.pid}" paraPrIDRef="{pp}" styleIDRef="0" pageBreak="{1 if page_break else 0}" '
                f'columnBreak="0" merged="0">{inner}</hp:p>')

    def text_p(self, text, size, font, pp, color='#000000', bold=False, page_break=False):
        r, plain = self.runs(text, size, font, color, bold)
        self.plain.append(plain)
        return self.p(r, pp, page_break)

    # ----- 표 -----
    def cell(self, paras, col, row, w, h, bf, header=False, colspan=1, rowspan=1, valign='CENTER', margin=(510, 510, 141, 141)):
        ml, mr, mt, mb = margin
        return (f'<hp:tc name="" header="{1 if header else 0}" hasMargin="1" protect="0" editable="0" dirty="0" borderFillIDRef="{bf}">'
                f'<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="{valign}" linkListIDRef="0" '
                f'linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">{paras}</hp:subList>'
                f'<hp:cellAddr colAddr="{col}" rowAddr="{row}"/><hp:cellSpan colSpan="{colspan}" rowSpan="{rowspan}"/>'
                f'<hp:cellSz width="{w}" height="{h}"/><hp:cellMargin left="{ml}" right="{mr}" top="{mt}" bottom="{mb}"/></hp:tc>')

    def table(self, rows_xml, nrow, ncol, width, height, bf, align='LEFT', repeat=1):
        self.pid += 1
        tbl = (f'<hp:tbl id="{1000000 + self.pid}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" '
               f'lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="{repeat}" rowCnt="{nrow}" colCnt="{ncol}" cellSpacing="0" '
               f'borderFillIDRef="{bf}" noAdjust="0"><hp:sz width="{width}" widthRelTo="ABSOLUTE" height="{height}" '
               f'heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" '
               f'holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="{align}" vertOffset="0" horzOffset="0"/>'
               f'<hp:outMargin left="0" right="0" top="141" bottom="141"/><hp:inMargin left="510" right="510" top="141" bottom="141"/>'
               + ''.join(f'<hp:tr>{r}</hp:tr>' for r in rows_xml) + '</hp:tbl>')
        pp = self.para(align='CENTER' if align == 'CENTER' else 'LEFT', ls=100, prev=200, nxt=200)
        return self.p(f'<hp:run charPrIDRef="0">{tbl}<hp:t/></hp:run>', pp)

    def data_table(self, rows, widths=None):
        ncol = max(len(r) for r in rows)
        rows = [r + [''] * (ncol - len(r)) for r in rows]
        if not widths:
            lens = [max(sum(2 if ord(ch) > 0x2e80 else 1 for ch in re.sub(r'[*_={}]', '', r[c])) for r in rows) + 4 for c in range(ncol)]
            lens = [min(max(x, 8), 60) for x in lens]
            widths = [TEXT_W * x // sum(lens) for x in lens]
        else:
            widths = [TEXT_W * x // sum(widths) for x in widths]
        widths[-1] += TEXT_W - sum(widths)
        bf_h, bf_c = self.border(fill=FILL_HEAD), self.border()
        pc, pl, pr = self.para('CENTER', ls=130), self.para('LEFT', ls=130), self.para('RIGHT', ls=130)
        out, mark = [], len(self.plain)
        for ri, r in enumerate(rows):
            cells = []
            for ci, txt in enumerate(r):
                txt = txt.strip()
                head = ri == 0
                bare = re.sub(r'[*_={}]', '', txt)
                color = RED if bare.startswith('▲') else BLUE if bare.startswith('▼') else '#000000'
                num = bool(re.fullmatch(r'[▲▼△▽+\-]?\s?[\d,.]+\s?(%|%p|명|건|회|개|대|원|천원|백만원|억원|억|㎡|시간|일|점)?', bare))
                pp = pc if head or len(bare) <= 14 else pl
                if num and not head:
                    pp = pr if len(rows) > 3 and re.search(r'\d,\d{3}', bare) else pc
                paras = self.text_p(txt, 11, F_GOTHIC, pp, color=color, bold=head)
                cells.append(self.cell(paras, ci, ri, widths[ci], 2100, bf_h if head else bf_c, header=head))
            out.append(''.join(cells))
        del self.plain[mark:]
        self.plain += [' | '.join(re.sub(r'[*_={}]', '', c).strip() for c in r) for r in rows]
        return self.table(out, len(rows), ncol, TEXT_W, 2100 * len(rows), bf_c)

    def one_cell(self, paras, bf, width=TEXT_W, height=2000, align='LEFT', valign='CENTER', margin=(700, 700, 400, 400)):
        return self.table([self.cell(paras, 0, 0, width, height, bf, valign=valign, margin=margin)], 1, 1, width, height, bf, align, repeat=0)


# ---------- 원고 읽기 ----------
BULLETS = [  # (머리 기호, 글자 크기, 글꼴, 첫 줄 위치, 내어쓰기, 위 간격)  단위 1/100pt · 둘째 줄부터는 첫 줄 위치 + 내어쓰기
    ('○', 15, F_BODY, 500, -2050, 900),
    ('-', 14, F_BODY, 2500, -900, 300),
    ('↳', 14, F_BODY, 3000, -1800, 200),
    ('▪', 13, F_BODY, 3000, -1500, 200),
    ('※', 12, F_GOTHIC, 2600, -1650, 200),
    ('*', 12, F_GOTHIC, 2600, -900, 200),
    ('☑', 12, F_GOTHIC, 500, -1500, 100),
]


def build(src):
    d = Doc()
    meta = {'부서': '', '날짜': '', '부제': '', '제목': '', '표지': '', '기관': '', '수신': ''}
    lines = src.replace('\r\n', '\n').split('\n')
    body_lines = []
    for ln in lines:
        m = re.match(r'@(부서|날짜|부제|제목|표지|기관|수신)\s*(.*)$', ln.strip())
        if m and not body_lines:
            meta[m.group(1)] = m.group(2).strip() or 'Y'
        else:
            body_lines.append(ln)
    if not meta['제목']:
        sys.exit('원고에 @제목 이 없습니다.')
    sub = meta['부제'] and '- ' + meta['부제'].strip('-– ').strip() + ' -'

    def header_box():   # 왼쪽 위: 부서 / 날짜
        if not (meta['부서'] or meta['날짜']):
            return ''
        w = min(max(len(meta['부서']) * 1150 + 1600, 16000), TEXT_W)
        bf = d.border()
        pc = d.para('CENTER', ls=130)
        rows = [d.cell(d.text_p(t, 10, F_GOTHIC, pc, bold=(i == 0)), 0, i, w, 1500, bf) for i, t in enumerate([meta['부서'], meta['날짜']]) if t]
        return d.table(rows, len(rows), 1, w, 1500 * len(rows), bf, repeat=0)

    def title_box(cover=False):
        pc = d.para('CENTER', ls=130)
        paras = (d.text_p(sub, 17 if cover else 16, F_HEAD, pc) if sub else '') + d.text_p(meta['제목'], 26 if cover else 23, F_HEAD, pc)
        if cover:
            bf = d.border('NONE', 'NONE', 'SOLID', 'SOLID', color='#6fa0c8', w='1.5 mm')
        else:
            bf = d.border('NONE', 'NONE', 'SOLID', 'SOLID', fill=FILL_TITLE, wt='0.4 mm', wb='0.7 mm')
        return d.one_cell(paras, bf, height=4600 if sub else 3000, margin=(300, 300, 350, 350))

    out = []
    first_inner = None      # 첫 문단에 구역 정보(secPr)를 넣어야 함
    blank = lambda size=10: d.text_p('', size, F_BODY, d.para(ls=100))

    if meta['표지']:
        out += [header_box()] + [blank(20)] * 7 + [title_box(cover=True)] + [blank(20)] * 5
        cover_date = meta['표지'] if meta['표지'] != 'Y' else re.sub(r'^(\D*\d{2,4})\.\s*(\d{1,2})\..*$', r'\1. \2.', meta['날짜'])
        out.append(d.text_p(cover_date, 22, F_BODY, d.para('CENTER'), bold=True))
        out += [blank(20)] * 6
        if meta['기관']:
            out.append(d.text_p(meta['기관'], 24, F_HEAD, d.para('CENTER')))
        pending_break = True
    else:
        pending_break = False

    out.append(header_box())
    if pending_break:
        out[-1] = out[-1].replace('pageBreak="0"', 'pageBreak="1"', 1) if out[-1] else ''
        if out[-1]:
            pending_break = False
    out.append(title_box())

    sec_no, i, n = 0, 0, len(body_lines)
    pp_h1 = d.para('LEFT', prev=1800, nxt=300, keep=True)
    pp_h2 = d.para('LEFT', left=600, prev=1000, nxt=100, keep=True)
    pp_cap = d.para('LEFT', left=600, prev=600, nxt=0, ls=130, keep=True)
    pp_unit = d.para('RIGHT', prev=0, nxt=0, ls=120, keep=True)
    pp_plain = d.para(left=500, prev=300)
    brk = False

    def add(xml):
        nonlocal brk
        if brk and xml:
            xml = xml.replace('pageBreak="0"', 'pageBreak="1"', 1)
            brk = False
        out.append(xml)

    if pending_break:
        brk = True

    while i < n:
        raw = body_lines[i]
        s = raw.strip()
        i += 1
        if not s:
            continue
        if re.fullmatch(r'-{3,}\s*쪽?\s*-*', s):
            brk = True
            continue
        m = re.match(r'#\s+(.*)', s)
        if m:                                              # Ⅰ. 큰 제목
            sec_no += 1
            num = ROMAN[sec_no - 1] if sec_no <= len(ROMAN) else str(sec_no)
            add(d.text_p(f'{num}. {m.group(1)}', 17, F_HEAD, pp_h1))
            continue
        m = re.match(r'##\s+(.*)', s)
        if m:                                              # □ 작은 제목
            add(d.text_p('□ ' + m.group(1), 15, F_HEAD, pp_h2))
            continue
        m = re.match(r'@붙임\s*(\d*)\s*(.*)', s)
        if m:                                              # 붙임 쪽 머리
            brk = True
            lab, w1 = '붙임' + (' ' + m.group(1) if m.group(1) else ''), 6800
            c1 = d.cell(d.text_p(lab, 16, F_HEAD, d.para('CENTER', ls=130), color='#ffffff'), 0, 0, w1, 2600, d.border(fill=NAVY))
            c0 = d.cell(d.text_p('', 8, F_BODY, d.para(ls=100)), 1, 0, 500, 2600, d.border('NONE', 'NONE', 'NONE', 'NONE'))
            c2 = d.cell(d.text_p(m.group(2), 16, F_HEAD, d.para('LEFT', ls=130)), 2, 0, TEXT_W - w1 - 500, 2600, d.border())
            add(d.table([c1 + c0 + c2], 1, 3, TEXT_W, 2600, d.border('NONE', 'NONE', 'NONE', 'NONE'), repeat=0))
            continue
        m = re.match(r'\[표\]\s*(.*)', s)
        if m:                                              # 표: 제목은 위, 단위는 오른쪽
            cap, _, unit = m.group(1).partition('|')
            widths, rows = None, []
            while i < n and body_lines[i].strip().startswith('|'):
                r = [c for c in body_lines[i].strip().strip('|').split('|')]
                i += 1
                if all(re.fullmatch(r'\s*:?-{2,}:?\s*', c) for c in r):
                    continue
                rows.append(r)
            mw = re.search(r'폭\s*[:=]\s*([\d\s:]+)', unit)
            if mw:
                widths = [int(x) for x in re.split(r'[:\s]+', mw.group(1).strip()) if x]
                unit = unit[:mw.start()].strip()
            if cap.strip():
                add(d.text_p(f'〈 {cap.strip()} 〉', 13, F_HEAD, pp_cap))
            if unit.strip():
                add(d.text_p(f'({unit.strip()})', 10, F_GOTHIC, pp_unit))
            if rows:
                if widths and len(widths) != max(len(r) for r in rows):
                    widths = None
                add(d.data_table(rows, widths))
            continue
        m = re.match(r'\[(그림|도표|사진)\]\s*(.*)', s)
        if m:                                              # 그림 · 도표 자리
            desc, _, h = m.group(2).partition('|')
            hmm = int(re.sub(r'\D', '', h) or 55)
            bf = d.border('DASH', 'DASH', 'DASH', 'DASH', fill=FILL_FIG, color=GRAY)
            pc = d.para('CENTER', ls=140)
            paras = d.text_p(f'〔 {m.group(1)} 자리 〕', 12, F_GOTHIC, pc, color=GRAY, bold=True) + d.text_p(desc.strip(), 11, F_GOTHIC, pc, color=GRAY)
            add(d.one_cell(paras, bf, height=round(hmm * MM)))
            continue
        m = re.match(r'\[박스\]\s*(.*)', s)
        if m:                                              # 강조 상자
            inner = []
            if m.group(1).strip():
                inner.append(d.text_p(f'< {m.group(1).strip()} >', 12, F_GOTHIC, d.para('LEFT', ls=140), bold=True, color=NAVY))
            while i < n and body_lines[i].strip() != '[/박스]':
                t = body_lines[i].strip()
                i += 1
                if not t:
                    continue
                deep = t.startswith(('-', '↳', '*', '※'))
                inner.append(d.text_p(t, 11 if deep else 12, F_GOTHIC, d.para('LEFT', left=1700 if deep else 200, indent=-800 if deep else -1500, ls=140)))
            i += 1
            add(d.one_cell(''.join(inner), d.border(fill=FILL_BOX, color=GRAY), valign='TOP', margin=(700, 700, 450, 450)))
            continue
        for mark, size, font, left, ind, prev in BULLETS:
            if s.startswith(mark + ' '):
                add(d.text_p(s, size, font, d.para(left=left, indent=ind, prev=prev)))
                break
        else:
            add(d.text_p(s, 14, F_BODY, pp_plain))

    out = [x for x in out if x]
    # 첫 문단에 구역 · 쪽 번호
    note = lambda tag, place, ln: (f'<hp:{tag}><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/>'
                                   f'<hp:noteLine length="{ln}" type="SOLID" width="0.12 mm" color="#000000"/>'
                                   f'<hp:noteSpacing betweenNotes="283" belowLine="567" aboveLine="850"/>'
                                   f'<hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="{place}" beneathText="0"/></hp:{tag}>')
    pbf = lambda t: (f'<hp:pageBorderFill type="{t}" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" '
                     f'fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill>')
    sec = (f'<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" '
           f'outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0"><hp:grid lineGrid="0" charGrid="0" '
           f'wonggojiFormat="0"/><hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/>'
           f'<hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" '
           f'hideFirstPageNum="{1 if meta["표지"] else 0}" hideFirstEmptyLine="0" showLineNumber="0"/>'
           f'<hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/>'
           f'<hp:pagePr landscape="WIDELY" width="{PAGE_W}" height="{PAGE_H}" gutterType="LEFT_ONLY">'
           f'<hp:margin header="{round(10 * MM)}" footer="{round(10 * MM)}" gutter="0" left="{MARGIN_LR}" right="{MARGIN_LR}" '
           f'top="{round(15 * MM)}" bottom="{round(15 * MM)}"/></hp:pagePr>'
           + note('footNotePr', 'EACH_COLUMN', -1) + note('endNotePr', 'END_OF_DOCUMENT', 14692344) + pbf('BOTH') + pbf('EVEN') + pbf('ODD') + '</hp:secPr>')
    lead = (f'<hp:run charPrIDRef="0">{sec}<hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0"/></hp:ctrl>'
            f'<hp:ctrl><hp:pageNum pos="BOTTOM_CENTER" formatType="DIGIT" sideChar="-"/></hp:ctrl>'
            + ('<hp:ctrl><hp:pageHiding hideHeader="0" hideFooter="0" hideMasterPage="0" hideBorder="0" hideFill="0" hidePageNum="1"/></hp:ctrl>' if meta['표지'] else '')
            + '</hp:run>')
    out[0] = re.sub(r'(<hp:p [^>]*>)', lambda m: m.group(1) + lead, out[0], count=1)
    section = XML_HEAD + f'<hs:sec {NS}>' + ''.join(out) + '</hs:sec>'
    return d, section, meta


# ---------- header.xml ----------
def header_xml(d):
    ti = '<hh:typeInfo familyType="FCAT_GOTHIC" weight="6" proportion="4" contrast="0" strokeVariation="1" armStyle="1" letterform="1" midline="1" xHeight="1"/>'
    faces = ''.join(f'<hh:fontface lang="{l.upper()}" fontCnt="{len(FONTS)}">'
                    + ''.join(f'<hh:font id="{i}" face="{f}" type="TTF" isEmbedded="0">{ti}</hh:font>' for i, f in enumerate(FONTS))
                    + '</hh:fontface>' for l in LANGS)
    bfs = []
    for key, bid in d.bf.items.items():
        sides = ''.join(f'<hh:{n}Border type="{key[k * 3]}" width="{key[k * 3 + 1]}" color="{key[k * 3 + 2]}"/>' for k, n in enumerate(['left', 'right', 'top', 'bottom']))
        fill = key[12]
        fx = f'<hc:fillBrush><hc:winBrush faceColor="{fill}" hatchColor="#999999" alpha="0"/></hc:fillBrush>' if fill else ''
        bfs.append(f'<hh:borderFill id="{bid}" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">'
                   f'<hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/>{sides}'
                   f'<hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/>{fx}</hh:borderFill>')
    cps = []
    for (h, font, bold, under, color, shade), cid in d.cp.items.items():
        cps.append(f'<hh:charPr id="{cid}" height="{h}" textColor="{color}" shadeColor="{shade}" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="2">'
                   f'<hh:fontRef {allv(font)}/><hh:ratio {allv(100)}/><hh:spacing {allv(0)}/><hh:relSz {allv(100)}/><hh:offset {allv(0)}/>'
                   + ('<hh:bold/>' if bold else '')
                   + f'<hh:underline type="{"BOTTOM" if under else "NONE"}" shape="SOLID" color="#000000"/><hh:strikeout shape="NONE" color="#000000"/>'
                   f'<hh:outline type="NONE"/><hh:shadow type="NONE" color="#B2B2B2" offsetX="10" offsetY="10"/></hh:charPr>')
    pps = []
    for (align, left, indent, prev, nxt, ls, keep), pid in d.pp.items.items():
        mg = lambda mul: ''.join(f'<hc:{k} value="{v * mul}" unit="HWPUNIT"/>' for k, v in [('intent', indent), ('left', left), ('right', 0), ('prev', prev), ('next', nxt)])
        pps.append(f'<hh:paraPr id="{pid}" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0">'
                   f'<hh:align horizontal="{align}" vertical="BASELINE"/><hh:heading type="NONE" idRef="0" level="0"/>'
                   f'<hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD" widowOrphan="0" keepWithNext="{1 if keep else 0}" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>'
                   f'<hh:autoSpacing eAsianEng="0" eAsianNum="0"/><hp:switch><hp:case hp:required-namespace="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar">'
                   f'<hh:margin>{mg(1)}</hh:margin><hh:lineSpacing type="PERCENT" value="{ls}" unit="HWPUNIT"/></hp:case><hp:default>'
                   f'<hh:margin>{mg(2)}</hh:margin><hh:lineSpacing type="PERCENT" value="{ls}" unit="HWPUNIT"/></hp:default></hp:switch>'
                   f'<hh:border borderFillIDRef="2" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/></hh:paraPr>')
    fmts = [('DIGIT', '^1.'), ('HANGUL_SYLLABLE', '^2.'), ('DIGIT', '^3)'), ('HANGUL_SYLLABLE', '^4)'), ('DIGIT', '(^5)'), ('HANGUL_SYLLABLE', '(^6)'), ('CIRCLED_DIGIT', '^7')]
    heads = ''.join(f'<hh:paraHead start="1" level="{i + 1}" align="LEFT" useInstWidth="1" autoIndent="1" widthAdjust="0" textOffsetType="PERCENT" textOffset="50" numFormat="{f}" charPrIDRef="4294967295" checkable="0">{t}</hh:paraHead>' for i, (f, t) in enumerate(fmts))
    return (XML_HEAD + f'<hh:head {NS} version="1.4" secCnt="1"><hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/><hh:refList>'
            f'<hh:fontfaces itemCnt="7">{faces}</hh:fontfaces><hh:borderFills itemCnt="{len(bfs)}">{"".join(bfs)}</hh:borderFills>'
            f'<hh:charProperties itemCnt="{len(cps)}">{"".join(cps)}</hh:charProperties>'
            f'<hh:tabProperties itemCnt="1"><hh:tabPr id="0" autoTabLeft="0" autoTabRight="0"/></hh:tabProperties>'
            f'<hh:numberings itemCnt="1"><hh:numbering id="1" start="0">{heads}</hh:numbering></hh:numberings>'
            f'<hh:paraProperties itemCnt="{len(pps)}">{"".join(pps)}</hh:paraProperties>'
            f'<hh:styles itemCnt="1"><hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042" lockForm="0"/></hh:styles>'
            f'</hh:refList><hh:compatibleDocument targetProgram="HWP201X"><hh:layoutCompatibility/></hh:compatibleDocument>'
            f'<hh:docOption><hh:linkinfo path="" pageInherit="0" footnoteInherit="0"/></hh:docOption><hh:trackchageConfig flags="56"/></hh:head>')


def write_hwpx(path, d, section, meta):
    now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    preview = '\n'.join(t for t in d.plain if t.strip())
    files = [
        ('mimetype', 'application/hwp+zip', True),
        ('version.xml', XML_HEAD + '<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" tagetApplication="WORDPROCESSOR" major="5" minor="1" micro="0" buildNumber="1" os="1" xmlVersion="1.4" application="Hancom Office Hangul" appVersion="9, 1, 1, 5656 WIN32LEWindows_10"/>', True),
        ('Contents/header.xml', header_xml(d), False),
        ('Contents/section0.xml', section, False),
        ('Preview/PrvText.txt', preview[:2000], False),
        ('settings.xml', XML_HEAD + '<ha:HWPApplicationSetting xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"><ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/></ha:HWPApplicationSetting>', False),
        ('META-INF/container.rdf', XML_HEAD + '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about=""><ns0:hasPart xmlns:ns0="http://www.hancom.co.kr/hwpml/2016/meta/pkg#" rdf:resource="Contents/header.xml"/></rdf:Description><rdf:Description rdf:about="Contents/header.xml"><rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#HeaderFile"/></rdf:Description><rdf:Description rdf:about=""><ns0:hasPart xmlns:ns0="http://www.hancom.co.kr/hwpml/2016/meta/pkg#" rdf:resource="Contents/section0.xml"/></rdf:Description><rdf:Description rdf:about="Contents/section0.xml"><rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#SectionFile"/></rdf:Description><rdf:Description rdf:about=""><rdf:type rdf:resource="http://www.hancom.co.kr/hwpml/2016/meta/pkg#Document"/></rdf:Description></rdf:RDF>', False),
        ('Contents/content.hpf', XML_HEAD + f'<opf:package {NS} version="" unique-identifier="" id=""><opf:metadata><opf:title>{escape(meta["제목"])}</opf:title><opf:language>ko</opf:language><opf:meta name="creator" content="text">DPV</opf:meta><opf:meta name="subject" content="text"/><opf:meta name="description" content="text"/><opf:meta name="lastsaveby" content="text">DPV</opf:meta><opf:meta name="CreatedDate" content="text">{now}</opf:meta><opf:meta name="ModifiedDate" content="text">{now}</opf:meta><opf:meta name="date" content="text"/><opf:meta name="keyword" content="text"/></opf:metadata><opf:manifest><opf:item id="header" href="Contents/header.xml" media-type="application/xml"/><opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/><opf:item id="settings" href="settings.xml" media-type="application/xml"/></opf:manifest><opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine></opf:package>', False),
        ('META-INF/container.xml', XML_HEAD + '<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf"><ocf:rootfiles><ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/><ocf:rootfile full-path="Preview/PrvText.txt" media-type="text/plain"/><ocf:rootfile full-path="META-INF/container.rdf" media-type="application/rdf+xml"/></ocf:rootfiles></ocf:container>', False),
        ('META-INF/manifest.xml', XML_HEAD + '<odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"/>', False),
    ]
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with zipfile.ZipFile(path, 'w') as z:
        for name, data, store in files:
            z.writestr(zipfile.ZipInfo(name, date_time=datetime.datetime.now().timetuple()[:6]), data.encode('utf-8'),
                       compress_type=zipfile.ZIP_STORED if store else zipfile.ZIP_DEFLATED)
    return preview


def register(path, preview, ver, note):
    idx = os.path.join(os.path.dirname(os.path.abspath(path)), 'index.json')
    data = json.load(open(idx, encoding='utf-8')) if os.path.exists(idx) else {'v': 1, 'items': [], 'folders': []}
    fid = os.path.basename(path)
    now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
    old = next((it for it in data['items'] if it.get('id') == fid), None)
    item = {'id': fid, 'name': fid[:-5] if fid.endswith('.hwpx') else fid, 'size': os.path.getsize(path),
            'created': old.get('created', now) if old else now, 'modified': now, 'preview': preview[:400]}
    if ver:
        item['ver'] = ver
    if note:
        item['note'] = note
    if old:
        for k in ('folder', 'pages'):
            if k in old:
                item[k] = old[k]
        data['items'][data['items'].index(old)] = item
    else:
        data['items'].append(item)
    with open(idx, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write('\n')


def lint(src):
    """양식 규칙에서 벗어난 곳을 알려 준다(막지는 않음)."""
    warns = []
    for no, ln in enumerate(src.split('\n'), 1):
        s = ln.strip()
        if s.startswith(('○ ', '- ', '↳ ')) and re.search(r'(습니다|합니다|입니다|됩니다|했다|한다|이다)[.]?$', s):
            warns.append(f'{no}행: 개조식이 아님(~함 · ~임 으로 끝내기) → {s[:40]}')
        if re.search(r'[△▽]', s):
            warns.append(f'{no}행: 증감 기호는 ▲ ▼ 로 통일 → {s[:40]}')
        if re.search(r'\d{4}\.\d{1,2}\.\d{1,2}', s):
            warns.append(f'{no}행: 날짜는 "2026. 11. 22." 처럼 온점 뒤를 띄움 → {s[:40]}')
    return warns


def main():
    ap = argparse.ArgumentParser(description='보고서 원고 → 학교장 보고서 양식 hwpx')
    ap.add_argument('source')
    ap.add_argument('-o', '--out', required=True)
    ap.add_argument('--register', action='store_true', help='같은 폴더의 index.json 에 문서를 올림')
    ap.add_argument('--ver')
    ap.add_argument('--note')
    a = ap.parse_args()
    src = open(a.source, encoding='utf-8').read()
    if os.path.exists(a.out) and not a.register:
        print(f'주의: {a.out} 을(를) 덮어씁니다. 고친 문서는 새 판 이름(v2 …)으로 저장하세요.', file=sys.stderr)
    d, section, meta = build(src)
    preview = write_hwpx(a.out, d, section, meta)
    if a.register:
        register(a.out, preview, a.ver, a.note)
    for w in lint(src):
        print('점검:', w, file=sys.stderr)
    blanks = src.count('확인 필요')
    print(f'{a.out}  ({os.path.getsize(a.out):,} bytes) · "확인 필요" {blanks}곳')


if __name__ == '__main__':
    main()
