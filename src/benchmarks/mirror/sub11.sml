
datatype btree = Empty | Node of int * btree * btree

fun mirror t =
  case t of
    Empty => Empty
  | Node (a, b, c) => if b = Empty orelse c = Empty then Node (a, c, b) else Node (a, mirror c, mirror b)

