import type { BaselineCharacteristics, Race } from "../../interface/character/Race";
import PcCharacterData from "../data/CharacterData";

export default class CharacterCreator {
    private characterData = new PcCharacterData()

    private unapplyCurrentRace() {

    }

    private applyRace(race: Race) {
        this.characterData.race = race;
    }

    chooseRace(race: Race) {
        if (this.characterData.race) this.unapplyCurrentRace();
        this.applyRace(race)
    }
}
