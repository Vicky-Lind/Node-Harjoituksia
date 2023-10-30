/* Harjoitus 8 Määrittele luokka, jossa on metodit keskiarvon,
keskihajonnan ja varianssin, suurimman ja pienimmän arvon laskemiseksi
argumenttina annetusta vektorista. */
const mathjs = require('mathjs')

class ArrayStats {
    constructor(array, decimals) {
        this.vektori = array;
        this.decimals = decimals;
    }

    keskihajonta() {
        return mathjs.std(vektori);
    }

    keskiarvo() {
        return math.mean(vektori);
    }

    varianssi() {
        return math.var(vektori);
    }

    suurin() {
        return math.max(vektori);
    }

    pienin() {
        return math.min(vektori);
    }
}

// Testataan luokkaa
let vektori = [1, 2, 3, 4, 5];
const matikkaInstance = new ArrayStats(vektori);
console.log(matikkaInstance.keskiarvo(vektori));
console.log(matikkaInstance.keskihajonta(vektori));
console.log(matikkaInstance.varianssi(vektori));
console.log(matikkaInstance.suurin(vektori));
console.log(matikkaInstance.pienin(vektori));
