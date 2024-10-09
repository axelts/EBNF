/** This module contains classes for some examples in chapter ten.
  *
  * @module Ten
  * @author © 2024 Axel T. Schreiner <axel@schreiner-family.net>
  * @version 2024-02-26
  */

/** [Example 10/07](../?mode=stack&eg=10/07): immediate evaluation. */
class Actions07 {
  /** `expr: add | subtract | ... | '(' expr ')' | number;` */
  expr (... arg) {
    return arg.length > 1 ? arg[1] : arg[0];
  }
  
  /** `add: expr '+' expr;` */
  add (a, x, b) { return a + b; }
  
  /** `subtract: expr '-' expr;` */
  subtract (a, x, b) { return a - b; }
  
  /** `multiply: expr '*' expr;` */
  multiply (a, x, b) { return a * b; }
  
  /** `divide:   expr '/' expr;` */
  divide   (a, x, b) { return a / b; }
  
  /** `power:    expr '**' expr;` */
  power    (a, x, b) { return a ** b; }
  
  /** `number:   Number;` */
  number   (number)  { return parseInt(number, 10); }
}

/** [Example 10/09](../?mode=stack&eg=10/09): unary minus. */
class Actions09 extends Actions07 {
  minus (x, a) { return - a; }
}

export {
  Actions07,
  Actions09
};
