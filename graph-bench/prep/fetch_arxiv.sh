#!/usr/bin/env bash
# Fetch ogbn-arxiv (Open Graph Benchmark; license ODC-BY — cite OGB + MAG) and extract the
# files the tier builder needs into graph-bench/prep/raw/ (gitignored).
#   https://ogb.stanford.edu/docs/nodeprop/#ogbn-arxiv
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p raw
if [ ! -f raw/arxiv.zip ]; then
  echo "downloading ogbn-arxiv (~79 MB)…"
  curl -L -o raw/arxiv.zip https://snap.stanford.edu/ogb/data/nodeproppred/arxiv.zip
fi
unzip -q -o raw/arxiv.zip -d raw \
  'arxiv/raw/edge.csv.gz' 'arxiv/raw/node_year.csv.gz' 'arxiv/raw/node-label.csv.gz' \
  'arxiv/mapping/nodeidx2paperid.csv.gz' 'arxiv/mapping/labelidx2arxivcategeory.csv.gz'
echo "done → raw/arxiv/"
