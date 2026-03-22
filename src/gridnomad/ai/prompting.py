from __future__ import annotations

from dataclasses import dataclass

from gridnomad.core.models import AgentState


@dataclass(slots=True)
class AgentMemoryView:
    memories: list[str]

    def recent_thoughts(self, limit: int = 5) -> list[str]:
        return self.memories[-limit:]


@dataclass(slots=True)
class AgentPromptView:
    name: str
    group: str
    personality: object
    emotions: object
    needs: object
    memory: AgentMemoryView
    x: int
    y: int

    @classmethod
    def from_agent(cls, agent: AgentState, memories: list[str]) -> "AgentPromptView":
        return cls(
            name=agent.name,
            group=agent.faction_id,
            personality=agent.personality,
            emotions=agent.emotions,
            needs=agent.needs,
            memory=AgentMemoryView(memories=memories),
            x=agent.x,
            y=agent.y,
        )


def build_agent_prompt(
    agent,
    perception: str,
    recent_events: list[str],
    recent_messages: dict[str, list[str]],
    cultural_context: str,
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

## Your Current State:
- Emotions (0-10): Joy={agent.emotions.joy}, Sadness={agent.emotions.sadness}, Fear={agent.emotions.fear}, Anger={agent.emotions.anger}, Disgust={agent.emotions.disgust}, Surprise={agent.emotions.surprise}
- Needs (0-10): Survival={agent.needs.survival}, Safety={agent.needs.safety}, Belonging={agent.needs.belonging}, Esteem={agent.needs.esteem}, Self_Actualization={agent.needs.self_actualization}
- Recent memories: {agent.memory.recent_thoughts()}
- Current location: ({agent.x}, {agent.y})

## What You See & Know Right Now:
Perception: {perception}
Recent events this tick: {recent_events}
Recent group messages: {recent_messages.get("civilization", [])}
Recent cross-group messages: {recent_messages.get("diplomacy", [])}
Your group's culture summary: {cultural_context}

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
- Keep speech short and natural.
- Use target_agent_id whenever you are choosing to talk to, help, follow, avoid, or confront a specific nearby human.
- Do not output generic MOVE. Use only MOVE_NORTH, MOVE_SOUTH, MOVE_EAST, or MOVE_WEST for movement.
- Do not invent kingdoms, races, cities, or fantasy systems. This is a group-of-humans simulator.

Now respond with your JSON decision.
""".strip()
