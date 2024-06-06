
datatype btree = Empty | Node of int * btree * btree

fun mirror t =
  case t of
    Empty => Empty
  | Node (n, tl, tr) => Node (n, mirror tr, mirror tl)

