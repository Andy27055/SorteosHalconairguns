// Ten tickets use 0..9; one hundred use 00..99, and so on.
export function lotteryDigitsFor(totalTickets:number){return Math.max(1,String(totalTickets-1).length);}
