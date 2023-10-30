/* Haluamme tallentaa ohjelmojasta tietoja avain-arvo-pareina:
- Nimi
- Pääasiallinen ohjelmointikieli
- Suuntautuminen: front end, back end tai full stack
- Mielitietokanta
Luo rakenne ja määrittele arvot.
*/

let ohjelmoija = {
    nimi: 'Matti',
    kieli: 'JavaScript',
    suuntautuminen: 'full stack',
    tietokanta: 'PostgreSQL'
}

const coder = new Map();
coder.set('nimi', 'Matti');
coder.set('kieli', 'JavaScript');
coder.set('suuntautuminen', 'full stack');
coder.set('tietokanta', 'PostgreSQL');
