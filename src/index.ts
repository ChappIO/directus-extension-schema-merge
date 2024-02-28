import {defineHook} from '@directus/extensions-sdk';
import {readFile, writeFile} from 'node:fs/promises';
import {dump as toYaml, load as fromYaml} from 'js-yaml';
import hash from "object-hash";


export default defineHook(async ({init}, {services, database, logger}) => {
    init('cli.after', ({program}: any) => {

        const syncCommand = program.command('schema-merge');

        syncCommand
            .command('apply')
            .description('Apply the schema')
            .argument('<file>')
            .action(async function (file: string) {
                const service = new services.SchemaService({
                    knex: database,
                    accountability: {
                        admin: true,
                    },
                });
                const oldSnapshot: any = await fromYaml(
                    await readFile(file, "utf-8"),
                );
                // restore data
                oldSnapshot.fields = oldSnapshot.collections.flatMap(
                    (c: { fields: unknown }) => c.fields || [],
                );
                oldSnapshot.relations = oldSnapshot.collections.flatMap(
                    (c: { relations: unknown }) => c.relations || [],
                );
                // drop additionals
                for (const collection of oldSnapshot.collections) {
                    delete collection.fields;
                    delete collection.relations;
                }

                const currentSnapshot = await service.snapshot();

                const diff = await service.diff(oldSnapshot, {currentSnapshot});

                if (diff === null) {
                    logger.info("Nothing to do");
                } else {
                    await service.apply({
                        diff,
                        hash: hash({
                            version: oldSnapshot.directus,
                            item: currentSnapshot,
                        }),
                    });
                }
                process.exit(0);
            });

        syncCommand
            .command('snapshot')
            .description('Dump the schema into a file')
            .requiredOption('-o, --output <targetFile>', 'The target output file')
            .action(async function (opts: any) {
                const service = new services.SchemaService({
                    knex: database,
                    accountability: {
                        admin: true,
                    },
                });
                const output = await service.snapshot();
                // process fields
                for (const field of output.fields) {
                    const collection = output.collections.find(
                        (c: {collection: string}) => c.collection === field.collection,
                    );
                    if (!collection) {
                        continue;
                    }
                    if (!("fields" in collection)) {
                        collection.fields = [];
                    }
                    collection.fields.push(field);
                }
                delete output.fields;
                // process relations
                for (const relation of output.relations) {
                    const collection = output.collections.find(
                        (c: { collection: string }) => c.collection === relation.collection,
                    );
                    if (!collection) {
                        continue;
                    }
                    if (!("relations" in collection)) {
                        collection.relations = [];
                    }
                    collection.relations.push(relation);
                }
                delete output.relations;

                // sort it all
                output.collections = output.collections.sort(
                    (a: { collection: string }, b: { collection: string }) =>
                        a.collection.localeCompare(b.collection),
                );

                for (const collection of output.collections) {
                    if (collection.fields) {
                        collection.fields = collection.fields.sort(
                            (a: { field: string }, b: { field: string }) =>
                                a.field.localeCompare(b.field),
                        );
                    }
                    if (collection.relations) {
                        collection.relations = collection.relations.sort(
                            (a: { field: string }, b: { field: string }) =>
                                a.field.localeCompare(b.field),
                        );
                    }
                }

                await writeFile(opts.output, toYaml(output));
                process.exit(0);
            });
    });
});