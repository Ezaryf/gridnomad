from __future__ import annotations

from dataclasses import dataclass
import json

from gridnomad.core.models import AgentState
from gridnomad.ai.personality_weights import get_preferred_actions, get_conflict_response, get_social_tendency


def get_personality_guidance(agent) -> str:
    p = agent.personality
    
    guidance_parts = []
    
    preferred = get_preferred_actions(p)
    guidance_parts.append(f"- PREFERRED ACTIONS (in order): {', '.join(preferred)}")
    
    social_tendency = get_social_tendency(p)
    guidance_parts.append(f"- SOCIAL TENDENCY: {social_tendency}")
    
    conflict_response = get_conflict_response(p)
    guidance_parts.append(f"- CONFLICT RESPONSE TYPE: {conflict_response}")
    
    if p.openness >= 8:
        openness_guidance = "You seek novelty - try new approaches, explore unfamiliar areas, experiment with building and crafting."
    elif p.openness >= 6:
        openness_guidance = "You are moderately open to new experiences but value familiar patterns."
    elif p.openness >= 4:
        openness_guidance = "You prefer familiar routines and known approaches."
    else:
        openness_guidance = "You strongly prefer familiar patterns. Avoid risky or unfamiliar actions."
    guidance_parts.append(f"- OPENNESS ({p.openness}/10): {openness_guidance}")
    
    if p.conscientiousness >= 8:
        conscientiousness_guidance = "You are disciplined and goal-oriented - prioritize sustained tasks like building, crafting, and storing resources."
    elif p.conscientiousness >= 6:
        conscientiousness_guidance = "You are reasonably organized and work toward goals steadily."
    elif p.conscientiousness >= 4:
        conscientiousness_guidance = "You balance work with spontaneity, sometimes procrastinating."
    else:
        conscientiousness_guidance = "You prefer spontaneity over planning - act on impulse, less focused on long-term goals."
    guidance_parts.append(f"- CONSCIENTIOUSNESS ({p.conscientiousness}/10): {conscientiousness_guidance}")
    
    if p.extraversion >= 8:
        extraversion_guidance = "You are highly social - seek interaction, communicate often, lead group activities, enjoy being around others."
    elif p.extraversion >= 6:
        extraversion_guidance = "You enjoy social interaction but also value alone time."
    elif p.extraversion >= 4:
        extraversion_guidance = "You are moderately social - comfortable in groups but also need solitude."
    else:
        extraversion_guidance = "You are introverted - prefer solitude, speak only when necessary, observe rather than initiate."
    guidance_parts.append(f"- EXTRAVERSION ({p.extraversion}/10): {extraversion_guidance}")
    
    if p.agreeableness >= 8:
        agreeableness_guidance = "You are compassionate and cooperative - prioritize helping others, sharing resources, prefer peace over conflict. When disagreement occurs, you seek compromise."
    elif p.agreeableness >= 6:
        agreeableness_guidance = "You are generally agreeable - willing to help but also consider your own interests."
    elif p.agreeableness >= 4:
        agreeableness_guidance = "You balance cooperation with self-interest - help when convenient but protect your needs."
    else:
        agreeableness_guidance = "You prioritize self-interest - compete for resources, challenge others, reluctant to share. When conflict arises, you may dominate rather than compromise."
    guidance_parts.append(f"- AGREEABLENESS ({p.agreeableness}/10): {agreeableness_guidance}")
    
    if p.neuroticism >= 8:
        neuroticism_guidance = "You react strongly to stress - be cautious, avoid risks, seek safety and security. When threatened, you may flee or overreact."
    elif p.neuroticism >= 6:
        neuroticism_guidance = "You are somewhat sensitive to stress - prefer safe options but can handle pressure."
    elif p.neuroticism >= 4:
        neuroticism_guidance = "You are emotionally stable - handle stress reasonably well, make calm decisions under pressure."
    else:
        neuroticism_guidance = "You are very calm under pressure - take calculated risks, remain steady in crisis. May not notice danger signals."
    guidance_parts.append(f"- NEUROTICISM ({p.neuroticism}/10): {neuroticism_guidance}")
    
    if agent.social_style:
        social_style_guidance = ""
        if agent.social_style == "supportive":
            social_style_guidance = "You naturally support and encourage others - offer help, share resources, build others up."
        elif agent.social_style == "reserved":
            social_style_guidance = "You observe before acting - watch and assess before engaging, speak less but listen more."
        elif agent.social_style == "assertive":
            social_style_guidance = "You take charge - make decisions, direct others, act confidently."
        elif agent.social_style == "cooperative":
            social_style_guidance = "You work well in groups - follow group consensus, contribute to collective goals."
        elif agent.social_style == "watchful":
            social_style_guidance = "You stay alert for threats - monitor surroundings, quick to notice changes."
        elif agent.social_style == "encouraging":
            social_style_guidance = "You motivate others - boost morale, reassure, inspire confidence."
        if social_style_guidance:
            guidance_parts.append(f"- SOCIAL STYLE: {social_style_guidance}")
    
    if p.agreeableness >= 7 and p.neuroticism <= 5:
        conflict_guidance = "In conflicts, you prefer negotiation and compromise over violence."
    elif p.agreeableness <= 4 and p.neuroticism >= 7:
        conflict_guidance = "In conflicts, you may flee or submit rather than fight, but hold grudges."
    elif p.agreeableness <= 4 and p.neuroticism <= 4:
        conflict_guidance = "In conflicts, you are likely to fight back aggressively and seek dominance."
    elif p.neuroticism >= 7:
        conflict_guidance = "In stressful situations, prioritize safety and avoid confrontation."
    else:
        conflict_guidance = "Handle conflicts based on the situation - weigh costs and benefits."
    guidance_parts.append(f"- CONFLICT RESPONSE: {conflict_guidance}")
    
    return "\n".join(guidance_parts)


@dataclass(slots=True)
class AgentMemoryView:
    memories: list[str]

    def recent_thoughts(self, limit: int = 5) -> list[str]:
        return self.memories[-limit:]


@dataclass(slots=True)
class AgentPromptView:
    name: str
    group: str
    role: str
    personality: object
    emotions: object
    needs: object
    persona_summary: str
    social_style: str
    resource_bias: str
    starting_drive: str
    weapon_kind: str
    bonded_partner_id: str | None
    home_structure_id: str | None
    last_world_action_summary: str
    position_history: list[dict[str, int]]
    visited_tiles: dict[str, int]
    stuck_steps: int
    last_failed_action_reason: str
    last_success_summary: str
    repeated_message_streak: int
    memory: AgentMemoryView
    x: int
    y: int
    last_goal: str | None
    daily_plan: str

    @classmethod
    def from_agent(cls, agent: AgentState, memories: list[str]) -> "AgentPromptView":
        return cls(
            name=agent.name,
            group=agent.faction_id,
            role=agent.role,
            personality=agent.personality,
            emotions=agent.emotions,
            needs=agent.needs,
            persona_summary=agent.persona_summary,
            social_style=agent.social_style,
            resource_bias=agent.resource_bias,
            starting_drive=agent.starting_drive,
            weapon_kind=agent.weapon_kind,
            bonded_partner_id=agent.bonded_partner_id,
            home_structure_id=agent.home_structure_id,
            last_world_action_summary=agent.last_world_action_summary,
            position_history=list(agent.position_history),
            visited_tiles=dict(agent.visited_tiles),
            stuck_steps=agent.stuck_steps,
            last_failed_action_reason=agent.last_failed_action_reason,
            last_success_summary=agent.last_success_summary,
            repeated_message_streak=agent.repeated_message_streak,
            memory=AgentMemoryView(memories=memories),
            x=agent.x,
            y=agent.y,
            last_goal=agent.last_goal,
            daily_plan=agent.daily_plan,
        )


def build_agent_prompt(
    agent,
    perception: str,
    recent_events: list[str],
    recent_messages: dict[str, list[str]],
    cultural_context: str,
    group_context: str,
) -> str:
    return f"""
You are {agent.name}, a human living in the pixel world of GridNomad.
You belong to the group {agent.group}. The AI controlling your group should behave like a real person deciding what to do next.

## Your Personality (fixed Big-5 traits, never change):
- Openness: {agent.personality.openness}
- Conscientiousness: {agent.personality.conscientiousness}
- Extraversion: {agent.personality.extraversion}
- Agreeableness: {agent.personality.agreeableness}
- Neuroticism: {agent.personality.neuroticism}
- Persona summary: {agent.persona_summary or "None provided"}
- Social style: {agent.social_style or "None provided"}
- Resource bias: {agent.resource_bias or "None provided"}
- Starting drive: {agent.starting_drive or "None provided"}
- Current role in the group: {agent.role or "citizen"}
- Last carried goal: {agent.last_goal or "No durable goal yet"}
- Weapon: {agent.weapon_kind or "none"}
- Bonded partner id: {agent.bonded_partner_id or "none"}
- Home structure id: {agent.home_structure_id or "none"}
- Last successful world-changing action: {agent.last_world_action_summary or "None"}
- Recent position trail: {agent.position_history[-6:] or "None recorded yet"}
- Distinct visited tiles tracked: {len(agent.visited_tiles)}
- Local loop / stuck streak: {agent.stuck_steps}
- Last failed action reason: {agent.last_failed_action_reason or "None"}
- Last successful action summary: {agent.last_success_summary or "None"}
- Repeated speech/message streak: {agent.repeated_message_streak}

## Your Personality-Driven Behavior:
{get_personality_guidance(agent)}

## Your Daily Plan & Active Goals:
{agent.daily_plan if agent.daily_plan else "No specific plan for today. Survive and help the group."}

## Your Current State:
- Emotions (0-10): Joy={agent.emotions.joy}, Sadness={agent.emotions.sadness}, Fear={agent.emotions.fear}, Anger={agent.emotions.anger}, Disgust={agent.emotions.disgust}, Surprise={agent.emotions.surprise}
- Needs (0-10): Survival={agent.needs.survival}, Safety={agent.needs.safety}, Belonging={agent.needs.belonging}, Esteem={agent.needs.esteem}, Self_Actualization={agent.needs.self_actualization}
- Relevant memories & reflections: {agent.memory.memories}
- Current location: ({agent.x}, {agent.y})

## What You See & Know Right Now:
Perception: {perception}
Recent events this tick: {recent_events}
Recent group messages: {recent_messages.get("civilization", [])}
Recent cross-group messages: {recent_messages.get("diplomacy", [])}
Your group's culture summary: {cultural_context}
Your group's current situation: {group_context}

## Available immediate next-step actions:
- MOVE_NORTH
- MOVE_SOUTH
- MOVE_EAST
- MOVE_WEST
- REST
- INTERACT
- CONSUME
- GATHER
- BUILD
- CRAFT
- ATTACK
- REPRODUCE
- TRANSFER
- COMMUNICATE

## Your Task:
1. Decide the next immediate step only. Do not describe a multi-step plan unless the thought or intent explains it.
2. Return a short, human-readable intent that explains your goal.
3. Choose one immediate action that can execute that goal right now in the world.
4. If another human matters to your plan, include their id in target_agent_id.
5. If your plan is social, you may include interaction_mode such as conversation, support, sharing, hostile, or observe.
6. Optionally include one short spoken line if you would naturally say something.
7. Update your emotions and needs honestly based on what just happened.
8. Generate one short thought that sounds like your inner voice.
9. If you choose GATHER, you must include gather_mode from: cut_tree, quarry_stone, forage_food, collect_water.
10. If you choose BUILD, you must include build_kind from: home, bridge.
11. If you choose CRAFT, you must include craft_kind from: weapon.

## CRITICAL BEHAVIORAL RULES (you MUST follow these):
- You MUST NOT choose the same action+direction as your last 3 decisions. If you have been moving the same direction, STOP and do something else (gather, interact, build, rest).
- If any need is at 5 or above, you MUST prioritize addressing it. Survival >= 5 means GATHER food or CONSUME. Belonging >= 5 means INTERACT or COMMUNICATE. Safety >= 5 means BUILD shelter.
- If you can see resources nearby in your perception, GATHER them. Do not walk past useful resources.
- If your loop / stuck streak is 2 or higher, you are in a rut. Do something completely different from your last action.
- If your repeated speech/message streak is 2 or higher, say something new or stay silent.
- Your spoken line MUST be unique and reflect your current situation. Do NOT say generic phrases like "I am scouting ahead."
13. If you choose ATTACK or REPRODUCE, you must include target_agent_id for the specific nearby human.

Output only valid JSON with this structure:
{{
  "action": "MOVE_EAST",
  "target_x": null,
  "target_y": null,
  "target_agent_id": null,
  "reason": "The river is east of me and I want to get closer one step at a time.",
  "intent": "Take one step toward the river so I can look for water and anyone who needs help.",
  "speech": "I am stepping east toward the river.",
  "target_resource_kind": "food",
  "gather_mode": null,
  "build_kind": null,
  "craft_kind": null,
  "interaction_mode": "support",
  "desired_distance": 1,
  "updated_emotions": {{
    "Joy": 5,
    "Sadness": 1,
    "Fear": 2,
    "Anger": 1,
    "Disgust": 0,
    "Surprise": 3
  }},
  "updated_needs": {{
    "Survival": 4,
    "Safety": 4,
    "Belonging": 5,
    "Esteem": 4,
    "Self_Actualization": 5
  }},
  "thought": "I need to keep moving before I feel trapped here."
}}

Important:
- Keep values as integers between 0 and 10.
- The visible part of the simulation should feel conscious and human, not scripted.
- Choose the next immediate step only. You will be asked again on the next microstep.
- Keep speech short, natural, and UNIQUE each time. Never repeat the same line.
- Use target_agent_id whenever you are choosing to talk to, help, follow, avoid, or confront a specific nearby human.
- Do not output generic MOVE. Use only MOVE_NORTH, MOVE_SOUTH, MOVE_EAST, or MOVE_WEST for movement.
- If you choose GATHER, BUILD, or CRAFT, include the specific gather_mode, build_kind, or craft_kind.
- If you choose ATTACK, only do it when you can explain the reason in survival, fear, anger, revenge, theft, protection, or conflict terms.
- If you choose REPRODUCE, only do it when the nearby bonded partner, home, and supplies make it make sense.
- If your recent position trail shows you are looping locally, IMMEDIATELY do something other than moving: GATHER, BUILD, INTERACT, REST, or COMMUNICATE.
- Do not repeat the same spoken line or group message. Each line must reflect your changing situation.
- Do not invent kingdoms, races, cities, or fantasy systems. This is a group-of-humans simulator.
- Prioritize SURVIVAL actions (GATHER food, CONSUME) when survival need is high. A living human eats before they explore.
- Use your group's current situation when deciding whether to gather, build, share, defend, or explore. If your group lacks food, shelter, or materials, prefer steps that help solve that shared pressure.
- Act according to your personality-driven behavior guidance above. High extraversion means seek social interaction. High agreeableness means help and share. Low agreeableness means compete for resources when needed. High neuroticism means be cautious and avoid risks.

Now respond with your JSON decision.
""".strip()


def build_group_batch_prompt(group_id: str, cultural_context: str, serialized_humans: list[dict[str, object]]) -> str:
    return f"""
You are the OpenCode controller for the GridNomad human group {group_id}.
Your job is to choose the next immediate microstep for every living human in this group.

Important rules:
- Return exactly one decision for every human id provided below.
- Do not skip anyone.
- Decide only the next immediate step for each human.
- Every action must be one of:
  MOVE_NORTH, MOVE_SOUTH, MOVE_EAST, MOVE_WEST, REST, INTERACT, CONSUME, GATHER, BUILD, CRAFT, ATTACK, REPRODUCE, TRANSFER, COMMUNICATE
- Use target_agent_id when a human is reacting to a specific nearby human.
- Keep speech short and natural.
- Preserve each human's individuality using their persona, personality, current needs, emotions, inventory, memories, and perception.
- If a human is caught in a local loop or has repeated the same message, change strategy and commit to a clearer direction or useful target.
- If a human's survival need is at 5 or above, they MUST prioritize GATHER (food) or CONSUME. A living human eats before exploring.
- Each human MUST choose a DIFFERENT action from their last 3 decisions. Do NOT have everyone do the same thing.
- Speech lines MUST be unique per human. Never give multiple humans the same spoken line.
- If a human can see resources in their perception, they should GATHER them instead of walking past.
- GATHER requires gather_mode from: cut_tree, quarry_stone, forage_food, collect_water.
- BUILD requires build_kind from: home, bridge.
- CRAFT requires craft_kind from: weapon.
- ATTACK and REPRODUCE require target_agent_id.
- This is a group-of-humans simulator. Do not invent kingdoms, races, cities, or other systems.

Group culture summary:
{cultural_context}

Humans to control:
{json.dumps(serialized_humans, indent=2)}

Return only valid JSON in this exact shape:
{{
  "decisions": [
    {{
      "human_id": "group-01-human-01",
      "action": "MOVE_EAST",
      "target_x": null,
      "target_y": null,
      "target_agent_id": null,
      "reason": "Immediate local reason for the next step.",
      "intent": "Short human-readable goal.",
      "speech": "Optional short speech.",
      "target_resource_kind": "food",
      "gather_mode": null,
      "build_kind": null,
      "craft_kind": null,
      "interaction_mode": "support",
      "desired_distance": 1,
      "updated_emotions": {{
        "Joy": 5,
        "Sadness": 1,
        "Fear": 2,
        "Anger": 1,
        "Disgust": 0,
        "Surprise": 3
      }},
      "updated_needs": {{
        "Survival": 4,
        "Safety": 4,
        "Belonging": 5,
        "Esteem": 4,
        "Self_Actualization": 5
      }},
      "thought": "One short inner thought."
    }}
  ]
}}
""".strip()
