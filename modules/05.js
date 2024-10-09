/** This module contains the classes for the last three examples in chapter five.

    @module Five
    @author © 2023 Axel T. Schreiner <axel@schreiner-family.net>
    @version 2024-02-06
*/

/** [Example 5/14](../?eg=05/14): actions to process a list of semicolon-terminated items. */
class Actions14 {
  /** `dec: 'dec' Decimal ';';` returns value */
  dec (_, decimal) { return parseInt(decimal, 10); }

  /** `hex: 'hex' ref ';';` returns value */
  hex (_, ref) { return parseInt(ref[0], 16); }
  
  /** `item: dec | hex;` returns `[ value ]`  
      `list: { item ';' };` displays value ... */
  list (some) { puts(... some.map(list => list[0][0])); }
}

/** [Example 5/15](../?eg=05/15): action to display a list of comma-separated items.
    @extends module:Five~Actions14 */
class Actions15 extends Actions14 {
  /** `item: dec | hex;` returns `[ value ]`  
      `list: { item ';' };` returns `[ value ... ]` */
  list (item, many) { 
    return item.concat(many ? many[0].map(list => list[1][0]) : []);
  }
  
  // alternative solution
  // list (item, many) {
  //   return (many ? many[0] : []).reduce(
  //     (result, list) => (result.push(list[1][0]), result), item);
  // }
}

/** [Example 5/16](../?eg=05/16): action to process a list of comma-separated items.
    @extends module:Five~Actions14 */
class Actions16 extends Actions14 {
  // convoluted solution
  // list (item, many) {
  //   return item.concat(many ? many[0].map(list => list[1][0]) : []).
  //     reduce((sum, value) => sum + value, 0);
  // }    

  /** `item: dec | hex;` returns `[ value ]`  
      `list: [{ ',' item }];` returns `value +...` */
  list (item, many) {
    return (many ? many[0] : []).reduce(
      (result, list) => result += list[1][0], item[0]); 
  }
}

export {
  Actions14,
  Actions15,
  Actions16
};
