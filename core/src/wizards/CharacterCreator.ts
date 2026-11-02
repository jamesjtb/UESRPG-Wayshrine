import type { BaselineCharacteristics, Race, RacialBonusChoice } from "../../interface/character/Race";
import type { AppliedTrait } from "../../interface/character/Trait";
import PcCharacterData from "../data/CharacterData";
import { Characteristic } from "../enum/Characteristic";

export default class CharacterCreator {
    private characterData = new PcCharacterData()
    private pendingChoices: RacialBonusChoice[] = [];

    private removeCurrentRace() {
        this.unapplyRacialBaseline();
        this.unapplyRacialTraits();
        delete this.characterData.race;
    }

    private applyRace(race: Race) {
        this.characterData.race = race;
        this.applyRacialBaseline(race.baselineCharacteristics);
        this.applyRacialTraits(race.racialTraits);
        this.pendingChoices = race.racialBonuses;
    }

    private applyRacialBaseline(baseline: BaselineCharacteristics) {
        for (const key of Object.values(Characteristic)) {
            this.characterData.updateCharacteristic(key, { baseline: baseline[key] })
        }
    }

    private unapplyRacialBaseline() {
        for (const key of Object.values(Characteristic)) {
            this.characterData.updateCharacteristic(key, { baseline: 0 })
        }
    }

    private applyRacialTraits(traits: readonly AppliedTrait[]) {
        this.characterData.traits.push(
            ...traits.map((trait): AppliedTrait => ({ ...trait, origin: "race" })),
        );
    }

    private unapplyRacialTraits() {
        this.characterData.traits = this.characterData.traits.filter(
            trait => trait.origin !== "race",
        );
    }

    chooseRace(race: Race) {
        if (this.characterData.race) this.removeCurrentRace();
        this.applyRace(race);
    }
}
