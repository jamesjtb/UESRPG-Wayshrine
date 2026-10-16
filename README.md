# UESRPG Wayshrine

UESRPG Wayshrine is a monorepo that is intended to house all digital tools available for UESRPG, a community-created TTRPG set in the Elder Scrolls universe.

**UESRPG Wayshrine is a Work-in-Progress.**

## Project Goals

### Project Longevity

To ensure the longevity of this project, it must pass the "Bus Test". Passing the Bus Test is simple: you ask the question "if the maintainer of this project is hit by a bus, does it all fall apart?". If the answer is yes, then the project has failed the Bus Test.

### Decouple Digital Tooling from the VTT

Digital tools that provide workflows like character creation/advancement, crafting tools, etc should not require the purchase of Foundry for UESRPG players to gain access. The decoupled digital tools provided by this project should have an option for free and easy rehosting. Furthermore each digital tool should provide multiple exports of the results of their workflows that can be used at any physical table or VTT.

Currently planned formats: PDF documents for editable form-filled .pdfs, images for uneditable, aesthetically pleasing character/item cards, and Foundry VTT with the door left open for other  VTT exports.

## Services

### Wayshrine Creation Kit (WCK)

Provide guided game prep workflows and some gameplay workflows for both GMs and Players.

#### Planned Tools
These are the planned tools for the project's full release. Additional features may be implemented post-release.

- [ ] Character Forge - Covers character creation and advancement
- [ ] NPC Profile Editor[^1] - Covers creation and editing of NPC Profiles
- [ ] Unconventional Spell Creator[^1] - Covers the creation of unconventional spells
- [ ] Enchantment Creator[^1] - Covers constant, strike, and cast enchantments
- [ ] Alchemist Workflows[^1] - Covers potion and poison creation (including toxins)
- [ ] Loot Generator[^1] - Covers procedural generation of artifacts, equipment, enchanted items, spell scrolls and tomes, and potions and poisons. Achieved by automating workflows established by other tools to create items that follow the official rules of the game, and can be opened in the relevant tool for editing where possible. 

[^1]: Name TBD

### Wayshrine Bridge

Wayshrine bridge is responsible for facilitating communication between the Wayshrine Creation Kit and the Foundry System Module (and other potential VTTs). This includes providing shared Typescript types between the two services.

#### Phases

Wayshrine Bridge will be deployed in two stages:
- [ ] shared types - this is the invisible compatibility layer between the VTT and WCK. Users will need to manually import the results from WCK into the VTT, likely by way of copy+paste to start.
- [ ] true integration - the current goal is to fully integrate Foundry and WCK so that WCK tools can be rendered from within the foundry system. This is subject to change and is likely the final priority to tackle before 1.0. That attempt will determine how close we can get to "true integration" in reality, so temper expectations.

### Foundry System Module

Provide a system module for Foundry VTT to facilitate moment-to-moment gameplay.

This is the planned scope for the project's full release. Additional features may be implemented post-release. Items that have been checked off have been implemented, but are still subject to drastic change until full release.

#### System Module Scope

##### Rules Compendium

Presented in order of appearance in the Rules Compendium, not in planned order of release.

**Chapter 1**

- [ ] basic gameplay
    - [ ] tests
        - [ ] standard tests
        - [ ] simple tests
        - [ ] opposed tests
        - [ ] extended tests
        - [ ] characteristic tests
        - [ ] skill tests
    - [ ] tests and other die rolls triggered by automated workflows prompt the relevant player before the roll is made
- [ ] player character sheet
    - [ ] Sheet layout, including sections for:
        - [ ] characteristics
        - [ ] attributes
        - [ ] skills
        - [ ] talents
        - [ ] traits
        - [ ] magic
        - [ ] items & encumbrance
        - [ ] active effects
    - [ ] stamina point abilities with automatic SP expenditure
    - [ ] luck
        - [ ] luck point abilities
        - [ ] burning luck
    - [ ] long & short rests
    - [ ] import character advancement results from Character Forge

**Chapter 2**

- [ ] import character creation results from Character Forge

**Chapter 3**

- [ ] skill item sheet
- [ ] provide official skills as compendium items

**Chapter 4**

- [ ] talents
    - [ ] talent item sheet
    - [ ] provide official talents as compendium items
- [ ] traits
    - [ ] trait item sheet
    - [ ] provide official traits as compendium items

**Chapter 5**

- [ ] combat workflows
    - [ ] initiative
    - [ ] attacking and defending (incl. hit location resolution)
    - [ ] action economy automation
    - [ ] death
    - [ ] apply the relevant penalties/bonuses to attacks based on the size of the target of the attack
- [ ] rollable tables in the compendium
    - [ ] hit locations
    - [ ] fear tables
    - [ ] diseases
- [ ] diseases
    - [ ] disease item sheet
    - [ ] provide official diseases as compendium items (curses will be covered alongside elite advances)

**Chapter 6**

- [ ] spellcasting
    - [ ] spell item sheet
    - [ ] conventional spell compendium items
    - [ ] import created unconventional spells from the spellcrafting tool
    - [ ] ritual item sheet
    - [ ] spellcasting workflow
    - [ ] MP cost deduction, including restraint
    - [ ] automatically apply spell damage and effects (including required rolls)
- [ ] alchemy
    - [ ] potion/poison/toxin item sheets
    - [ ] import crafted potion/poison/toxin from alchemy
- [ ] include rollable mishap tables in compendium
- [ ] enchanting
    - [ ] enchantment item sheets applied to equipment item sheets
    - [ ] import created enchantments from the enchanting tool

**Chapter 7**

- [ ] Item Sheets
    - [ ] good - defined in the "Goods & Services" section
    - [ ] soul gem - dedicated sheet type or just another good with extra values?
    - [ ] spell tome - ""
    - [ ] alchemical ingredient - ""
    - [ ] weapon
    - [ ] armor
    - [ ] shield
    - [ ] assign prices to previously implemented item sheets where necessary (potions, enchantments, etc)

**Chapter 8**

TBA - likely after 1.0 as a separate update.

