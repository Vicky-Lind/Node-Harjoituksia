// A CJS LIBRARY TO CALCULATE BASIC STATISTICAL CHARASTERISTICS OF AN ARRAY
// ========================================================================

// LIBRARIES
// ---------

// Statistical operations are based on math.js library
// It is not built-in Math class, need to install this 1st
const mathjs = require('mathjs'); 

// A class to calculate statistical characteristics at given precision
class ArrayStats {
    constructor(array, decimals) {
        this.array = array;
        this.decimals = decimals;
    }


    // Average ie aritmeettinen keskiarvo 
    mean() {
        const arrayMean = mathjs.mean(this.array);
        const roundedMean = mathjs.round(arrayMean, this.decimals);
        return roundedMean


    }

    /* Median ie keskiluku eli järjestetyn lukujonon keskimmäinen arvo 
    (pariton määrä lukuja) tai kahden keskimmäisen arvon keskiarvo 
    (parillinen määrä lukuja)
    */
    median() {
        const arrayMedian = mathjs.median(this.array);
        const roudedArrayMedian = mathjs.round(arrayMedian, this.decimals);
        return roudedArrayMedian;

    }
    // Mode ie tyyppiarvo eli luku, joka esiintyy eniten lukujoukossa
    mode() {
        const arrayMode = mathjs.mode(this.array);
        return arrayMode

    }

    // Variation of popultation ie populaation varianssi
    populationVariance() {
        const arrayVariance = mathjs.variance(this.array, 'uncorrected');
        const roundedArrayVariance = mathjs.round(arrayVariance, this.decimals);
        return roundedArrayVariance;

    }

    // Standard deviation of population ie populaation keskihajonta
    populationStdDev() {
        const arrayDeviation = mathjs.std(this.array, 'uncorrected');
        const roundedArrayDeviation = mathjs.round(arrayDeviation, this.decimals);
        return roundedArrayDeviation;

    }

    // Maximum value of array ie maksimi tai suurin arvo
    max() {
        const arrayMax = mathjs.max(this.array);
        const roundedArrayMax = mathjs.round(arrayMax, this.decimals);
        return roundedArrayMax;

    }

    // Minimum value of array ie minimi tai pienin arvo
    min() {
        const arrayMin = mathjs.min(this.array);
        const roundedArrayMin = mathjs.round(arrayMin, this.decimals);
        return roundedArrayMin;
    }

}

module.exports = {
    ArrayStats
}