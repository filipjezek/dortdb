%start root
%token STAR

%%

root: STAR { console.log('hello'); } ;