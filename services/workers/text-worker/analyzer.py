"""
Text analysis engine (HU-16).

Uses spaCy for NER + custom risk-keyword matching.
"""

import re
from collections import Counter
from dataclasses import dataclass, field

import spacy

_nlp = None


def _get_nlp():
    global _nlp
    if _nlp is None:
        _nlp = spacy.load("en_core_web_sm")
    return _nlp


# ── Risk keyword taxonomy ─────────────────────────────────────────────────────

RISK_WORDS: dict[str, tuple[str, str]] = {
    # word → (category, severity)

    # Violence
    "weapon": ("violence", "critical"), "bomb": ("violence", "critical"),
    "explosive": ("violence", "critical"), "detonate": ("violence", "critical"),
    "kill": ("violence", "critical"), "murder": ("violence", "critical"),
    "assassinate": ("violence", "critical"), "attack": ("violence", "high"),
    "assault": ("violence", "high"), "threat": ("violence", "high"),
    "hostage": ("violence", "high"), "kidnap": ("violence", "high"),

    # Terrorism
    "terrorist": ("terrorism", "critical"), "terrorism": ("terrorism", "critical"),
    "jihad": ("terrorism", "critical"), "extremist": ("terrorism", "critical"),
    "radicalize": ("terrorism", "high"), "cell": ("terrorism", "medium"),

    # Cybercrime
    "malware": ("cybercrime", "critical"), "ransomware": ("cybercrime", "critical"),
    "exploit": ("cybercrime", "critical"), "zero-day": ("cybercrime", "critical"),
    "backdoor": ("cybercrime", "critical"), "rootkit": ("cybercrime", "critical"),
    "hack": ("cybercrime", "high"), "breach": ("cybercrime", "high"),
    "phish": ("cybercrime", "high"), "trojan": ("cybercrime", "high"),
    "keylogger": ("cybercrime", "high"), "spyware": ("cybercrime", "high"),
    "vulnerability": ("cybercrime", "medium"), "sql injection": ("cybercrime", "high"),

    # Financial crime
    "fraud": ("financial_crime", "high"), "laundering": ("financial_crime", "high"),
    "bribe": ("financial_crime", "high"), "extort": ("financial_crime", "high"),
    "counterfeit": ("financial_crime", "high"), "forgery": ("financial_crime", "high"),
    "embezzle": ("financial_crime", "high"), "corruption": ("financial_crime", "medium"),

    # Drug trafficking
    "cocaine": ("drug_trafficking", "critical"), "heroin": ("drug_trafficking", "critical"),
    "methamphetamine": ("drug_trafficking", "critical"), "fentanyl": ("drug_trafficking", "critical"),
    "narco": ("drug_trafficking", "high"), "cartel": ("drug_trafficking", "high"),
    "traffick": ("drug_trafficking", "high"), "smuggle": ("drug_trafficking", "high"),

    # Evasion
    "tor": ("evasion", "medium"), "darkweb": ("evasion", "medium"),
    "dark web": ("evasion", "medium"), "anonymous": ("evasion", "low"),
    "cryptocurrency": ("evasion", "low"), "monero": ("evasion", "medium"),
    "untraceable": ("evasion", "medium"), "encrypted": ("evasion", "low"),
    "offshore": ("evasion", "medium"), "shell company": ("evasion", "medium"),
}

SEVERITY_ORDER = {"low": 0, "medium": 1, "high": 2, "critical": 3}


@dataclass
class TextAnalysisResult:
    entities: list[dict] = field(default_factory=list)        # spaCy NER
    keywords: list[str]  = field(default_factory=list)        # top N nouns
    risk_matches: list[dict] = field(default_factory=list)    # risk word hits
    categories: dict[str, int] = field(default_factory=dict)  # category → hit count
    overall_severity: str = "low"
    word_count: int = 0
    language_hint: str = "en"


def analyze(text: str) -> TextAnalysisResult:
    result = TextAnalysisResult()

    # Normalize
    text = text.strip()
    if not text:
        return result

    result.word_count = len(text.split())

    nlp  = _get_nlp()
    # Truncate to spaCy limit (1MB should be fine)
    doc  = nlp(text[:500_000])

    # ── Named entity recognition ──────────────────────────────────────────────
    seen_ents: set[str] = set()
    for ent in doc.ents:
        key = f"{ent.label_}:{ent.text.strip()}"
        if key in seen_ents or len(ent.text.strip()) < 2:
            continue
        seen_ents.add(key)
        result.entities.append({"text": ent.text.strip(), "label": ent.label_})

    # ── Keyword extraction (top frequent content nouns/propn) ─────────────────
    noun_freq: Counter = Counter()
    for token in doc:
        if token.pos_ in ("NOUN", "PROPN") and not token.is_stop and len(token.lemma_) > 2:
            noun_freq[token.lemma_.lower()] += 1
    result.keywords = [w for w, _ in noun_freq.most_common(20)]

    # ── Risk keyword matching ─────────────────────────────────────────────────
    text_lower = text.lower()
    for keyword, (category, severity) in RISK_WORDS.items():
        # whole-word / phrase match
        pattern = r"\b" + re.escape(keyword) + r"\b"
        matches = re.findall(pattern, text_lower)
        if matches:
            result.risk_matches.append({
                "keyword": keyword,
                "category": category,
                "severity": severity,
                "count": len(matches),
            })
            result.categories[category] = result.categories.get(category, 0) + len(matches)

    # ── Overall severity ──────────────────────────────────────────────────────
    if result.risk_matches:
        worst = max(result.risk_matches, key=lambda m: SEVERITY_ORDER[m["severity"]])
        result.overall_severity = worst["severity"]

    return result
