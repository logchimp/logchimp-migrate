# LogChimp migrate

This is a CLI tool to migrate your existing data from other software providers to LogChimp.

Please refer to the table below and the relevant documentation for the providers we support for the data migration.

| Provider | Posts | Boards | Roadmaps | Votes | Users | Documentation                   |
|----------|-------|--------|----------|-------|-------|---------------------------------|
| Astuto   | ✅️    | ✅️     | ✅️️       | 🚧️️    | 🚧️    | [Link](./docs/astuto/readme.md) |

### Few things to note

To import boards and roadmaps data you will need to subscribe to a paid plan.

You can do a dry run to see what would be imported without actually importing anything by adding `--dry-run` flag.

- Boards are matched by name (case-insensitive) or created.
- Roadmaps are matched by name (case-insensitive) or created (requires LogChimp Enterprise license).
- Posts keep original author, date and status in a footer.
- Progress is stored in `.logchimp-migrate-state.json`, so re-runs skip imported posts and roadmaps.
- Failures go to `logchimp-migrate-report.json`.
