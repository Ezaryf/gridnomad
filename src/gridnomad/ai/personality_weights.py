from __future__ import annotations

from dataclasses import dataclass
from gridnomad.core.models import AgentState, BigFivePersonality


ACTION_WEIGHTS = {
    "explore": {
        "openness": 1.5,
        "conscientiousness": 0.8,
        "extraversion": 1.2,
        "agreeableness": 1.0,
        "neuroticism": -0.5,
    },
    "build": {
        "openness": 1.3,
        "conscientiousness": 1.5,
        "extraversion": 0.9,
        "agreeableness": 1.1,
        "neuroticism": 0.5,
    },
    "gather": {
        "openness": 0.9,
        "conscientiousness": 1.3,
        "extraversion": 0.8,
        "agreeableness": 1.0,
        "neuroticism": 0.8,
    },
    "rest": {
        "openness": 0.7,
        "conscientiousness": -0.3,
        "extraversion": -0.5,
        "agreeableness": 1.0,
        "neuroticism": 1.2,
    },
    "social": {
        "openness": 1.1,
        "conscientiousness": 0.8,
        "extraversion": 1.8,
        "agreeableness": 1.4,
        "neuroticism": -0.3,
    },
    "communicate": {
        "openness": 1.1,
        "conscientiousness": 0.9,
        "extraversion": 1.6,
        "agreeableness": 1.3,
        "neuroticism": 0.0,
    },
    "attack": {
        "openness": 1.0,
        "conscientiousness": 0.9,
        "extraversion": 1.1,
        "agreeableness": -1.5,
        "neuroticism": 0.8,
    },
    "flee": {
        "openness": 0.6,
        "conscientiousness": 0.7,
        "extraversion": -0.3,
        "agreeableness": 0.5,
        "neuroticism": 1.8,
    },
    "craft": {
        "openness": 1.4,
        "conscientiousness": 1.4,
        "extraversion": 0.8,
        "agreeableness": 1.0,
        "neuroticism": 0.3,
    },
    "share": {
        "openness": 1.0,
        "conscientiousness": 1.0,
        "extraversion": 1.2,
        "agreeableness": 1.8,
        "neuroticism": -0.5,
    },
    "hoard": {
        "openness": 0.8,
        "conscientiousness": 1.2,
        "extraversion": 0.7,
        "agreeableness": -1.2,
        "neuroticism": 0.5,
    },
    "negotiate": {
        "openness": 1.2,
        "conscientiousness": 1.1,
        "extraversion": 1.3,
        "agreeableness": 1.5,
        "neuroticism": -0.3,
    },
}


@dataclass
class PersonalityActionWeights:
    explore: float
    build: float
    gather: float
    rest: float
    social: float
    communicate: float
    attack: float
    flee: float
    craft: float
    share: float
    hoard: float
    negotiate: float


def calculate_action_weights(personality: BigFivePersonality) -> PersonalityActionWeights:
    weights = {}
    
    for action, trait_weights in ACTION_WEIGHTS.items():
        total_weight = 0.0
        trait = trait_weights.get
        
        total_weight += personality.openness * trait("openness")
        total_weight += personality.conscientiousness * trait("conscientiousness")
        total_weight += personality.extraversion * trait("extraversion")
        total_weight += personality.agreeableness * trait("agreeableness")
        total_weight += personality.neuroticism * trait("neuroticism")
        
        weights[action] = max(0.1, total_weight)
    
    return PersonalityActionWeights(
        explore=weights.get("explore", 1.0),
        build=weights.get("build", 1.0),
        gather=weights.get("gather", 1.0),
        rest=weights.get("rest", 1.0),
        social=weights.get("social", 1.0),
        communicate=weights.get("communicate", 1.0),
        attack=weights.get("attack", 1.0),
        flee=weights.get("flee", 1.0),
        craft=weights.get("craft", 1.0),
        share=weights.get("share", 1.0),
        hoard=weights.get("hoard", 1.0),
        negotiate=weights.get("negotiate", 1.0),
    )


def get_action_modifier(action: str, personality: BigFivePersonality) -> float:
    weights = calculate_action_weights(personality)
    
    action_map = {
        "explore": weights.explore,
        "build": weights.build,
        "gather": weights.gather,
        "rest": weights.rest,
        "social": weights.social,
        "communicate": weights.communicate,
        "attack": weights.attack,
        "flee": weights.flee,
        "craft": weights.craft,
        "share": weights.share,
        "hoard": weights.hoard,
        "negotiate": weights.negotiate,
        "MOVE_NORTH": weights.explore,
        "MOVE_SOUTH": weights.explore,
        "MOVE_EAST": weights.explore,
        "MOVE_WEST": weights.explore,
        "INTERACT": weights.social,
        "CONSUME": weights.gather,
        "GATHER": weights.gather,
        "BUILD": weights.build,
        "CRAFT": weights.craft,
        "ATTACK": weights.attack,
        "REPRODUCE": weights.social,
        "TRANSFER": weights.share,
        "COMMUNICATE": weights.communicate,
    }
    
    return action_map.get(action, 1.0)


def get_preferred_actions(personality: BigFivePersonality, top_n: int = 3) -> list[str]:
    weights = calculate_action_weights(personality)
    
    action_scores = [
        ("explore", weights.explore),
        ("build", weights.build),
        ("gather", weights.gather),
        ("rest", weights.rest),
        ("social", weights.social),
        ("communicate", weights.communicate),
        ("attack", weights.attack),
        ("flee", weights.flee),
        ("craft", weights.craft),
        ("share", weights.share),
        ("hoard", weights.hoard),
        ("negotiate", weights.negotiate),
    ]
    
    action_scores.sort(key=lambda x: x[1], reverse=True)
    return [action for action, _ in action_scores[:top_n]]


def get_conflict_response(personality: BigFivePersonality) -> str:
    if personality.agreeableness >= 7:
        if personality.neuroticism >= 6:
            return "flee"
        return "negotiate"
    elif personality.agreeableness <= 4:
        if personality.neuroticism >= 6:
            return "flee"
        return "attack"
    else:
        if personality.neuroticism >= 7:
            return "flee"
        return "negotiate"


def get_social_tendency(personality: BigFivePersonality) -> str:
    if personality.extraversion >= 7:
        return "leader"
    elif personality.extraversion >= 5:
        return "participant"
    elif personality.extraversion >= 3:
        return "observer"
    else:
        return "solitary"


def get_resource_tendency(personality: BigFivePersonality) -> str:
    if personality.agreeableness >= 7:
        return "share"
    elif personality.agreeableness <= 4:
        return "hoard"
    else:
        return "balanced"
