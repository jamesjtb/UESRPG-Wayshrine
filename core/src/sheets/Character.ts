import PcCharacterData from "../data/CharacterData";

export default abstract class CharacterSheet {
    private characterData: PcCharacterData;

    constructor() {
        this.characterData = new PcCharacterData();
    }
}
