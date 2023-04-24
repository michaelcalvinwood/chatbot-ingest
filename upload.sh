#!/bin/bash

rsync -a --exclude "node_modules" . root@ingest-1.instantchatbot.net:/home/ingest/
