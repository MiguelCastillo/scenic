# Wingborn

A young ling grows from a hatchling that can only walk into the leader of its
colony. It gets stronger with its friends, earns its wings, and leads the
colony to defeat Red Hill.

Its first scene is `hops.json`, Mushroom Hops: a mossy clearing of
mushroom perches to land on in order, against the clock, from the one the
ling starts on. Space flaps, which climbs and uses energy, the left and
right arrows turn, and the down arrow dives. Gliding sinks, and gives a
little energy back once the ling has stopped flapping a moment. The ling
lands on caps and on the ground, where the up and down arrows walk, and
standing gives its energy back, faster on a cap. It sticks to the giant
trees where it touches them, and climbs them, up the trunk and out along the
branches. A cyan ring marks the next perch, and the pause menu starts the
run over (see `scripts/fly.js` and `scripts/course.js`). Its models come from
`bin/generate-ling.js`, `bin/generate-mushroom.js`, `bin/generate-grass.js`,
`bin/generate-tree.js` and `bin/generate-rock.js`. The scene doesn't copy
their colliders or the trees' skeletons: it names the models they come
from, and loadScene fills them in from the models' meta files (see "Model
meta files" in the main README). The rest of this is the story so far, to build
the other scenes from.

## The world

The game is ant-sized: a backyard is the whole world. Grass is a forest, a
puddle is a lake, and a dropped soda can is a ruin.

- **The root colony**, the player's home: tunnels and chambers under an old
  tree. It is tight-knit and scrappy, and the player can choose any wings.
- **Red Hill**, fire ants in a big dirt mound out in the open. They are
  aggressive and proud, and fly Darters. They are the enemy.
- **The Weavers**, leaf nests up in the bushes. Clever builders who keep to
  themselves, and fly Hoverers. For later.
- **The Drifters**, nomads with no fixed home. Traders and scouts who follow
  the wind, and fly Riders. For later.

## Characters

The names are placeholders.

- **The ling**, the player.
- **Pip**, the rival: always racing you, a little jealous, and later your
  right hand.
- **Moss**, the cautious one: careful and steady, never wants to fly.
- **Zip**, the reckless one: first to jump, first to get hurt.
- **The mentor**, an old ant who runs the nursery and later the molting
  chamber, and comments on the player's choices.

## How the game is built: Goal and Growth

Every stage has two tracks:

- **Goal**: the story mission the stage works toward. It is about Red Hill,
  and its stakes are real.
- **Growth**: how the ling gets stronger. Races, obstacle courses and
  training with friends. They are low-stakes and can be replayed.

Growth earns rewards: molts, wings, gear and mastery. The Goal
tests them: it can be tried early, but it is hard until the ling has trained.
Beating the Goal unlocks the next stage and its Growth activities. Growth
takes place where the Goal will happen, so the ling learns the ground before
it fights on it, and friends show up on both tracks.

## The ling's body

### Wings

Any ant can earn wings, by growing up; it isn't luck. They bud at the first
molt, the end of stage 2, and each later molt is a reward that shapes them.
Flying drains one energy bar, and each wing type spends it differently:

| Wing type                  | Speed  | Flight time       | Feel                                                 |
| -------------------------- | ------ | ----------------- | ---------------------------------------------------- |
| **Glider** (broad, strong) | Slow   | Long              | Soars far, for scouting and endurance races          |
| **Darter** (narrow, fast)  | Fast   | Short             | Sprints in bursts, then has to land                  |
| **Hoverer** (rounded)      | Medium | Medium            | Turns tight and holds still in the air, for fighting |
| **Rider** (light, wide)    | Slow   | Very long in wind | Rides breezes and thermals, weak in still air        |

Landing restores energy, so routes matter. Missions favor different wings, so
no type is the best. Friends choose wings too, so a squad's mix matters.

### Other parts

- **Arms**: carrying and grabbing, a quick strike, and holding gear and the
  slingshot.
- **Legs**: climbing, or speed on the ground.
- **Antennae**: sensing, finding paths, and later signalling to friends,
  which is how commanding starts.

### The slingshot

A forked twig with a spider-silk band, the reward for completing stage 1.
Later upgrades are stronger, such as a Giant's rubber band, a rare find.
Its mastery speeds up the draw, steadies the aim, and adds a charged shot.

Slingshots come in types that trade power, range and fire rate, the way
wings trade speed and flight time. No type is the best:

| Slingshot                                | Power  | Range  | Fire rate | Good for                                                   |
| ---------------------------------------- | ------ | ------ | --------- | ---------------------------------------------------------- |
| **Twig** (the first)                     | Medium | Medium | Medium    | A bit of everything                                        |
| **Brute** (thick fork, doubled band)     | High   | Short  | Slow      | Close fights, breaking barricades                          |
| **Longshot** (long fork, stretched silk) | Low    | Long   | Slow      | Picking off enemies from far, with Glider wings high above |
| **Quick** (small fork, light band)       | Low    | Medium | Fast      | Many shots in a pass, with Darter wings                    |

New types come as rewards, from defeated enemies and from things made in
the world. The ling keeps every slingshot it finds, in its inventory, and
picks the one to carry from there. Each type has its own mastery.

In stage 2 it shoots only pebbles: plain damage that knocks enemies back. In
stage 3 it can be shot while flying: Hoverers hold still to aim, Darters
shoot in quick passes, and Gliders from high above. Special ammo comes in
stages 3 and 4:

| Ammo       | Made from                      | Effect                                                                     | Weak against                     |
| ---------- | ------------------------------ | -------------------------------------------------------------------------- | -------------------------------- |
| **Pebble** | Small stones                   | Damage and knockback                                                       | Nothing in particular            |
| **Fire**   | Embers, hot pepper seeds       | Burns over time, and lights dry grass, hurting everyone near, the ling too | Red Hill: fire ants shrug it off |
| **Poison** | Toxic berries, mushroom spores | A cloud that weakens enemies, drifting with the wind                       | Wind that blows it back          |
| **Ice**    | Frozen dew, morning frost      | Slows or freezes enemies, who take more damage frozen                      | Heat, which melts it             |

Ice is the best against Red Hill, where fire, the obvious choice, is the
wrong one. Friends favor ammo too: Zip loves fire, and Moss defends with
ice.

Ammo is infinite to start. Later, play-testing can try having the ling
collect its own, such as pebbles from the ground and berries, spores and
frost found in the world, and see how that feels.

The ling carries both the slingshot and a melee weapon, but uses one at a
time, switching between them. The slingshot sits in a holster at its side,
on a strap across the chest, so it can be seen on the ling whichever one it
is using, and drawing it from the hip is the switch. The strap is the
ling's first gear: plain silk when it is Young, and part of its armor as an
adult.

### Artifacts

Gear made from things found in the world, such as a beetle-shell wing guard,
a dragonfly-vein brace or a dew-drop energy sac, tunes a build on top of the
wings.

### Mastery

Each skill has its own mastery, such as each wing type, the arms, the legs
and the antennae. Mastery grows by using the skill in Growth. Each stage
raises its cap: growing up opens the next level, and practice fills it. A
hatchling can't train its way to adult strength.

### Swapping wings

Wings can be swapped at the colony's molting chamber, between missions, for a
little food. New wings start at mastery 1: clumsy, slower, and they drain
energy faster until practiced. A wing type the ling has trained keeps its
mastery, so switching back is cheap.

## The four stages

| Stage            | Goal                                               | Growth                                                               |
| ---------------- | -------------------------------------------------- | -------------------------------------------------------------------- |
| **1. Hatchling** | Defend the food stash from a Red Hill scout raid   | Walking and climbing courses, carrying races, scent trails           |
| **2. Young**     | Win ground skirmishes as Red Hill raids get bolder | Sparring, obstacle courses through the grass forest, mentor training |
| **3. Winged**    | Survive Red Hill's air attack on the colony        | Flight races, the inter-colony tournament, energy courses            |
| **4. Adult**     | Lead the final assault on Red Hill                 | Squad drills, mastering every wing type, command practice            |

Leading grows across the stages: the ling follows orders as a hatchling,
fights beside friends who act on their own as a Young ant, and gives simple
commands as an adult, such as flank, follow me and hold. In the finale the
whole squad follows the ling's plan.

### 1. Hatchling

The ling is small and can't fight yet. It wins by being quick, clever and
helpful, which sets up wanting to learn to fight in stage 2.

The ling hatches in the nursery, where its first moments teach it to walk.
Pip, Moss and Zip hatch nearby, and the mentor greets them.

Growth, with legs, arms and antennae up to mastery 2:

| Activity        | What you do                                                        | Skill             | Friend moment                                      |
| --------------- | ------------------------------------------------------------------ | ----------------- | -------------------------------------------------- |
| **Tunnel Run**  | Race friends through the colony's tunnels                          | Legs: speed       | Pip always wins at first                           |
| **Root Climb**  | Climb up the tree roots toward daylight                            | Legs: climbing    | Zip rushes and falls; Moss is slow but never slips |
| **Crumb Haul**  | Carry food to the stores; heavier crumbs are worth more but slower | Arms: carrying    | A first taste of the wing trade-offs               |
| **Scent Trail** | Follow trails through dark tunnels and the grass edge              | Antennae: sensing | A strange sharp smell: Red Hill's                  |

The Root Climb ends at a view of the grass edge, with winged ants flying
overhead: what the ling grows toward. The Scent Trail introduces Red Hill
before the ling ever sees one.

Goal, the Stash Raid: at dusk, Red Hill scouts sneak into the outer food
store. The ling can't fight them, so it uses everything it trained:

1. Senses them (antennae), from the smell on the trail.
2. Raises the alarm (legs: speed), a Tunnel Run with real stakes.
3. Saves the food (arms), hauling it to the inner chambers with friends.
4. Blocks the way (legs: climbing), knocking a pebble into the tunnel.

It wins once the alarm is raised and enough food is saved. Faster legs give
it more time, and stronger arms let it carry more.

The adults drive the scouts off. For a moment the ling is face to face with
a scout, bigger, with sharp mandibles, and can only run. The mentor says it's
time to learn to fight, and gives the ling its reward for the stage: a
slingshot, a forked twig with a spider-silk band, that shoots pebbles. The
ling becomes a Young ant.

### 2. Young

In stage 1 the ling could only run from Red Hill. Now it learns to fight
back, and at the end it faces the scout that scared it.

It goes out into the grass forest: tall blades, fallen leaves for bridges,
dew drops and pebbles. Beyond it are the puddle, where the colony forages,
and the soda can, a half-buried ruin on the border with Red Hill.

The ling learns to fight, with only three moves, so the game is easy to
play:

- **Strike** (arms): a quick hit.
- **Dodge** (legs): a quick sidestep or roll, which is also how it defends.
- **Shoot** (arms): pebbles from the slingshot, stage 1's reward. They hit
  from afar, but reloading is slow, so striking stays the main move.

Besides those, the button that picks up crumbs grabs pebbles and debris, to
shove, throw or build with, and one button signals a friend. When an attack
is coming, the ling's antennae sense it on their own, and a small hint shows,
with no button to press.

Stage 1's skills go up to mastery 3, and the new moves go from 1 to 3.

Growth:

| Activity            | What you do                                                                  | Skill                            | Friend moment                                         |
| ------------------- | ---------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------- |
| **Sparring Ring**   | One-on-one with friends, in a ring the mentor runs                           | Arms: strike                     | Pip is fast, Moss is hard to hit, Zip swings wild     |
| **Grass Run**       | An obstacle course of leaf bridges, dew drops and falling seeds              | Legs: dodge                      | It runs over the ground the skirmishes happen on      |
| **Pebble Push**     | Grab pebbles and twigs to build barricades or clear paths, against the clock | Arms: grab                       | Moss hates fighting but loves building, and is strong |
| **Border Patrol**   | Walk the border with a friend, read scents, spot ambushes                    | Antennae: reading and signalling | The first call to a friend, where leading starts      |
| **Dewdrop Gallery** | Shoot dew drops off leaves, against the clock and friends                    | Slingshot: aim                   | Pip wants to beat you at this too                     |

By the end of the stage the ling can tap its antennae to call one friend to
help: its first command.

Goal, the Border Skirmishes: Red Hill's raids grow bolder, in three fights,
each bigger than the last.

1. **The grass edge**: the ling and a friend drive off two scouts.
2. **The puddle**: Red Hill ambushes a foraging party. The ling protects the
   foragers while it fights, and spots where the ambush comes from, as on
   Border Patrol.
3. **The soda can**: Red Hill makes the can an outpost on the border. The
   ling and all three friends take it back, grabbing debris to break Red
   Hill's barricade or build their own. The boss is the scout from stage 1.

Friends fight on their own: Pip charges, Moss holds a line, and Zip does
something bold and risky. The ling can signal one at a time.

The scout retreats. As the dust settles, the ling sees winged Red Hill ants
circling high above the can: they were watching, and next time they will
come from the sky. Back home, the ling molts for the first time and its wing
buds appear. The colony gathers at the top of the root for its first flight,
a short, wobbly hop with its friends, and it becomes a Winged ant.

### 3. Winged

The world opens into the sky. Flying feels like freedom, until Red Hill
shows the sky is a battlefield too.

From the air the ling sees the whole backyard for the first time: the
puddle, the soda can, and Red Hill's mound far off. Mushroom towers are
perches, so flights go from one to the next. The fallen log is the colony's
race course, breeze lanes run between rocks and bushes, shown by drifting
seeds and dust, and the old stump is the tournament's arena.

The ling learns to fly:

- **First wings**: it picks a wing type at the molting chamber. All four are
  open, each starting at mastery 1.
- **Energy**: flying drains it and landing on a perch restores it. Knowing
  when to land is the skill.
- **Dive** (wings): a swoop from above into a strike.
- **Air dodge** (wings): a quick roll in the air.
- **Shoot in flight** (slingshot).

Wing types go up to mastery 2, and the ground skills up to 4.

Growth:

| Activity          | What you do                                                              | Skill                         | Friend moment                                                            |
| ----------------- | ------------------------------------------------------------------------ | ----------------------------- | ------------------------------------------------------------------------ |
| **Mushroom Hops** | Fly cap to cap on longer and longer routes without running out of energy | Wings: energy and landing     | Zip skips a cap, runs dry and drops into the moss: unhurt, but a warning |
| **Log Run**       | Lap races over, under and through the fallen log                         | Wings: speed and turning      | Pip, flying Darter, is the one to beat                                   |
| **Breeze Lane**   | A course through the wind lanes, riding gusts and fighting crosswinds    | Wings: riding the wind        | Zip picks Rider wings and goes wherever the wind goes                    |
| **Sky Gallery**   | Shoot targets on leaves and seeds in flight                              | Slingshot: shooting in flight | The Dewdrop Gallery, from the air                                        |
| **Wing Trials**   | Try other wing types at the molting chamber, paying the retraining cost  | Wings: other types            | The mentor comments on the picks                                         |

Moss won't fly, and stays on the ground building perches and windbreaks for
the courses.

The seasonal tournament at the old stump is the stage's big Growth event,
where young flyers from every colony race. In the heats the ling flies
against the Weavers, Hoverers who are best on tight courses, and the
Drifters, Riders who are best in wind, and sees every wing in action. Red
Hill's champion, Cinder, a placeholder name, is cocky and fast and flies
Darter. The final is the ling against Cinder, and the story works whether
the ling wins or not. Cinder makes it personal: "Enjoy the sky while you
have it." The prize, or the runner-up's, is fire ammo, the first special
ammo.

Goal, the Sky Raid: the night after the tournament, Red Hill attacks from
the air.

1. **Spot them** (antennae): from the top of the root, the ling sees the
   swarm coming and signals the colony.
2. **Hold the sky**: dogfights above the colony. Fire ammo does nothing to
   fire ants, and Moss, or the mentor, shouts to use frozen dew, which
   unlocks ice ammo.
3. **Fire in the grass**: Red Hill lights dry grass near the colony. The
   ling shoots ice to put it out and flies friends to safety, and Moss
   flies for the first time, to save a hatchling.

Red Hill pulls back, but Zip chases Cinder too far, alone, and Red Hill
takes Zip. The colony is hurt: the grass is burned and the top of the root
is damaged. The mentor gathers the friends: Red Hill won't stop, and the
colony needs someone to lead. The ling molts again, into full wings and a
stronger body, and becomes an Adult. Its first mission is to bring Zip home.

The raid teaches that the obvious weapon can be the wrong one: the player
learns to think about the enemy, Red Hill feels real as fire ants, and Moss
is the one who keeps a clear head. Fire ammo isn't useless, so the prize
doesn't feel wasted: it still burns through spider webs and clears
brambles.

Moss's arc is about courage: afraid of the sky all stage, Moss flies the
moment someone needs help. In stage 4 Moss becomes the colony's builder and
defender, planning the barricades for the assault on Red Hill.

Winning the tournament doesn't change the story, so losing never blocks it,
but it leaves small marks:

- **Cinder's taunt**: a winner hears an angry, humiliated Cinder ("You got
  lucky, sky-baby"), and a loser a smug one. Either way, the raid that night
  is personal.
- **A trophy**: a winner's wing marking or a badge on the strap, which other
  players can see.
- **The other colonies notice**: a Weaver or a Drifter flyer remembers the
  ling, which sets up a friend from another colony later.

### 4. Adult

Tentative, at a high level, to be detailed later.

The ling stops following and becomes the one others follow: Growth is about
leading, and the Goal can't be won alone.

- **Red Hill's leader**: Warlord Scorch, a placeholder name, a huge, old,
  scarred fire ant in heat-proof plates, too heavy to fly. Scorch and the
  mentor were rivals when young, as the ling and Cinder are, and Cinder is
  Scorch's child. Or Red Hill could have a Red Queen instead.
- **Learned**: commands (follow me, hold, flank, focus a target), wings up
  to mastery 4 with each type's best move, and poison ammo. Everything
  reaches its highest mastery.
- **Growth**: Squad Drills, leading friends through courses; a Spore Hunt
  for poison; Mastery Trials for each wing type; Mound Recon, mapping Red
  Hill from high up; and the War Games, every match mode.
- **Goal, part 1, Bring Zip Home**: a night rescue in Red Hill's tunnels.
  Pip charges in against orders, is cornered and saved, and from then on is
  the ling's right hand. Zip comes home more patient, and knows the inside
  of the mound.
- **Goal, part 2, the Assault on Red Hill**: the ling plans first, choosing
  each friend's wings and role from Zip's map and the recon. A push on the
  ground behind Moss's barricades, then a duel in the sky against Cinder,
  who yields and is spared, then Scorch in the throne chamber, beaten only
  with ice, poison and the squad's commands.
- **The ending**: Red Hill retreats. At the top of the root, where the ling
  first flew, the mentor steps aside and the colony chooses the ling, for
  how its friends followed it. The last shot is the friends flying over the
  backyard at sunset. Maybe Cinder watches from afar, or a Giant's shadow
  passes over, as a hook for later.

The outline it came from:

Stronger wings, arms and antennae, and the first commands. The ling
picks its squad's wings and plans its missions: scouting, sabotage and
rescues. The finale is the assault on Red Hill, a push on the ground and a
battle in the air, with each friend flying to their wings, joined by the
lings of friends from matches (see Multiplayer). Red Hill falls,
and the colony chooses the ling as its leader, for how it led rather than how
hard it hit.

## Multiplayer

Every player's ling grows up in the root colony, so the story is the same
for everyone, and friends can always play it together.

### The story, together

Each player is their own ling, with its own wings, mastery and markings.
Friends join as extra lings from the colony, fighting and racing beside the
player's squad. The story friends, Pip, Moss and Zip, are always NPCs,
because the story needs them to: Zip is captured, Moss flies to save a
hatchling, and Pip becomes the ling's right hand. The mentor doesn't fight,
but gives missions and runs the nursery and the molting chamber.

### Matches

A match is a short game, a few minutes long, apart from the story. Matches
are part of Growth: another way to get stronger, along with races and
obstacle courses. They are played between story missions, at the training
grounds by the old stump, where the mentor runs war games for young ants.

Beating a stage's Goal unlocks its Goal as a mode, so the player learns it
in the story and then plays it against friends:

| Mode             | Unlocked by        | How it plays                                                                    |
| ---------------- | ------------------ | ------------------------------------------------------------------------------- |
| **Stash Raid**   | Stage 1            | Red Hill sneaks in to steal food, and the colony defends and hauls it to safety |
| **Hold the Can** | Stage 2            | A fight on the ground for the soda can, king of the hill                        |
| **Sky Raid**     | Stage 3            | Dogfights in the air, attackers against defenders                               |
| **Team races**   | Its stage's Growth | The Log Run or Breeze Lane as a relay, or each team's total time                |

Growth activities, such as the Tunnel Run, the Sparring Ring and the Dewdrop
Gallery, can also be played free-for-all, from the start of their stage.

A match goes the way a Bubble Squadron race does:

1. Pick a mode at the training grounds.
2. Play solo with NPCs, or with friends, with Auto join, Join by code or
   Start new race.
3. The lobby makes the teams: up to six players, three against three.
   Friends who joined together stay on one team, teams are balanced by
   stage, and NPCs fill empty seats on both sides.
4. One team plays as the root colony and the other as Red Hill, for this
   match only.
5. Rounds last a few minutes. In attack and defend modes, such as the Stash
   Raid and the Sky Raid, teams switch sides at halftime, so everyone
   attacks once and defends once.
6. Everyone goes home to the root colony.

Races are open to anyone, since wings are a strategy as much as strength.
Fights are fair because the lobby balances teams by stage.

A match earns mastery in the skills it used, and every player gets gear at
the end, win or lose, which goes to their inventory. The winning team also
gets a chest, such as an acorn-cap cache, with extra rewards: more gear, a
better chance at rare pieces, and badges and markings.

The tournament from stage 3 can come back as a seasonal event, with
brackets open to everyone and special rewards.

### How matches feed the story

What matches give helps in the story, but is never needed to finish it, so
a player who plays alone still reaches the ending.

- **Gear only matches give**, in the end-of-match rewards and the winners'
  chests. Playing as Red Hill earns Red Hill gear, such as heat-proof plates
  that guard against fire, a help when the grass burns in the Sky Raid.
  Winning as the colony earns colony gear, such as a signal horn that calls
  friends from farther away. Rare materials, such as a Giant's rubber band
  for the best slingshots, come only from matches and seasonal tournaments.
- **Friends fly in the finale.** In the assault on Red Hill, the lings of
  real friends the player has played matches with join the battle, flown by
  the computer, with their own wings, gear and markings, even when those
  friends aren't online. The more friends, the bigger the army: the story's
  leader with friends at their side, made real.

### Team colors

The root colony's amber and Red Hill's brick red are too close to tell
apart in a fast fight, so a team's color is an accent on the ling's strap,
its wings and the tips of its antennae: cyan for the root colony and red
for Red Hill, keeping the amber body.

### Later

If the Uniter ending comes, Red Hill could get a story of its own, where
the player chooses a colony to keep for the journey and sees the war from
Red Hill's side. Every player starting in the root colony leaves room for
that.

Matches could also unlock optional story missions, such as a Drifter scout,
met at a seasonal tournament, with a secret about Red Hill that leads to a
rare slingshot. Set aside for now: it adds too much to the game to start
with.

## Art direction

The reference art is for inspiration only; Wingborn's designs are its own.

### The ling

- **Big head, small body** when young, with huge glossy eyes that read at a
  distance, behind a chase camera. Softly arched brows keep it friendly and
  curious.
- **An ant's body**: head, a small chest, and a round abdomen, with a pinched
  waist.
- **Four legs and two arms**: the legs give a steady stance, and the arms
  carry, grab, strike, signal and hold gear.
- **Elbowed antennae** that bend in the middle, and show how it feels:
  drooping when sad, perked up when alert.
- **A simple mouth, no mandibles**: a single line that smiles, shouts or
  worries, for expression. No nose and no teeth. Red Hill keeps sharp
  mandibles, so the enemy reads at a glance and looks a little scarier.
- **Colors**: warm amber and brown for the root colony, with a lighter belly.
  Red Hill is brick red with darker armor. In matches, a team color shows as
  an accent (see Team colors).
- **Each player's ling is a little different**, with its own markings and
  color patterns on the amber, the way each Bubble Squadron player's ship is.

The look grows up with the stages, keeping the same face:

| Stage         | Head to body           | Eyes                | Arms                 | Wings                      | Posture                     |
| ------------- | ---------------------- | ------------------- | -------------------- | -------------------------- | --------------------------- |
| **Hatchling** | As big as the body     | Huge and round      | Thin and short       | None                       | Wobbly, stubby legs         |
| **Young**     | Still big, body longer | Big, a brow forming | Stronger             | Buds at the end            | Steadier, a fighting stance |
| **Winged**    | More balanced          | Big and focused     | Athletic             | Small, shaped by wing type | Leaner, athletic            |
| **Adult**     | Smaller than the body  | Confident           | Strong, holding gear | Full                       | Upright, a leader's stance  |

### Gear

From stage 3, armor, weapons and shields are artifacts made from backyard
things, such as a seed-husk shield, a thorn sword or beetle-shell plates. A
fully geared adult looks like a warrior: armored, angular and determined,
where the hatchling was soft and round.

Defeated enemies drop special gear. They are knocked out or retreat rather
than die, and leave something behind: a Red Hill soldier's heat-proof plate,
which guards against fire, or a scout's light leg guards. Bosses drop gear of
their own that no one else has, such as Cinder's.

### The outdoors

Chunky, soft shapes, with nothing sharp or realistic: rounded rocks, puffy
bushes and thick stumps. Moss is the signature: soft green caps dripping
over rocks and logs. Colors are painted in two tones, light on top and dark
below, with little light speckles. Warm browns against the greens put the
amber ling in the same family as the wood and mushrooms, and it stands out
against the grass.

At ant scale, these are the landscape:

| Object               | To an ant                                              |
| -------------------- | ------------------------------------------------------ |
| **Mushroom cluster** | Towers and platforms, landing spots for short flights  |
| **Fallen log**       | A tunnel or a long bridge, for races                   |
| **Stump**            | An arena, such as the Sparring Ring or the tournament  |
| **Mossy rocks**      | Hills and cliffs, for the Root Climb and the Grass Run |
| **Leaf sprouts**     | The trees of the grass forest                          |
| **Bushes**           | Dense jungles, such as the Weavers' home               |
| **Real trees**       | Giants on the horizon, like mountains                  |

## Later

- **A Uniter ending**: a bigger danger, such as a flood, a predator or the
  Giants (humans), threatens every colony, and the ling unites them,
  including its rival.
- **The Weavers and the Drifters**, as places to explore and, later, as
  allies.
- **A friend from a rival colony**, made at the tournament.
- **Choices that matter**, such as sparing a Red Hill scout, which lean the
  ending toward peace or war.
