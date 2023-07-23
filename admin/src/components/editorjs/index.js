import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { createReactEditorJS } from 'react-editor-js'
import MediaLibComponent from '../medialib/component';
import {changeFunc, getToggleFunc} from '../medialib/utils';

import { useFetchClient, auth } from '@strapi/helper-plugin';
import { Loader } from '@strapi/design-system';
import { Typography as Typ } from '@strapi/design-system';
import { Flex } from '@strapi/design-system';
import { EmptyStateLayout } from '@strapi/design-system';
import pluginId from '../../pluginId';

const EditorJs = createReactEditorJS();

const Editor = ({ onChange, name, value }) => {

    const fetchClient = useFetchClient();

    const [editorInstance, setEditorInstance] = useState();
    const [mediaLibBlockIndex, setMediaLibBlockIndex] = useState(-1);
    const [isMediaLibOpen, setIsMediaLibOpen] = useState(false);

    const [toolpackModule, setToolpackModule] = useState(null);

    const [tools, setTools] = useState(null);

    const [toolpackError, setToolpackError] = useState(null);

    const createEjsObject = () => {
        const ejs = {
            pluginEndpoint: `${strapi.backendURL}/${pluginId}`,
            authToken: auth.getToken(),
            fetchClient,
            mediaLib: {
                toggle: mediaLibToggleFunc
            }
        }
        return ejs;
    }

    useEffect(() => {
        // check if the toolpack on the server is valid
        
        fetchClient.get(
            `${strapi.backendURL}/${pluginId}/toolpackValid`, 
            // we want to check the response rather than just throw
            {validateStatus: () => true}
        )
            .then((resp) => {

                // if it's valid, load the toolpack
                if (resp.status === 200) {
                    return import(/*webpackIgnore: true*/`${strapi.backendURL}/${pluginId}/toolpack`);

                // if it's not valid, the reason is in the body
                } else if (resp.status === 400) {
                    throw new Error(resp.data)
                
                // for something unexpected, then throw an unexpected error
                } else {
                    throw new Error('Unexpected Error.');
                }
            })
            .then(module => {
                setToolpackModule(module);
            })
            .catch((err) => {
                setToolpackError(err.message);
            })

    }, [])

    useEffect(() => {
        // we need the module
        if (toolpackModule === null) { return; }

        try {
            const toolCreator = toolpackModule.createTools;
            const tls = toolCreator(createEjsObject());
            setTools(tls);
        } catch(err) {
            setToolpackError(`Failed to hydrate toolpack tools - ${err.message}`);
        }

    }, [toolpackModule])

  const mediaLibToggleFunc = useCallback(getToggleFunc({
    openStateSetter: setIsMediaLibOpen,
    indexStateSetter: setMediaLibBlockIndex
  }), []);

  const handleMediaLibChange = useCallback((data) => {
    changeFunc({
        indexStateSetter: setMediaLibBlockIndex,
        data,
        index: mediaLibBlockIndex,
        editor: editorInstance
    });
    mediaLibToggleFunc();
  }, [mediaLibBlockIndex, editorInstance]);

  const renderEditor = (actualEditor) => {

    if (toolpackError !== null) {
        return <>
            <EmptyStateLayout
                content="Failed to load Toolpack" 
                action={<Typ textAlign="center" variant="pi">{toolpackError}</Typ>}
            />
        </>
    } else if (tools === null) {
        return <>
            <Flex alignItems='center' justifyContent='center' direction='column' paddingTop={6} paddingBottom={6}>
                <Loader small/>
                <Typ variant="epsilon">Loading Toolpack...</Typ>
            </Flex>
        </>
    } else {
        return actualEditor();
    }
    
  }
  

  return (
    <>
      <div style={{ border: `1px solid rgb(227, 233, 243)`, borderRadius: `2px`, marginTop: `4px` }}>

        {renderEditor(() => <> 
            <EditorJs
                onChange={(api, ev) => {
                    api.saver.save().then(newData => {
                        if (!newData.blocks.length) {
                            onChange({ target: { name, value: null } });
                        } else {
                            onChange({ target: { name, value: JSON.stringify(newData) } });
                        }
                    });
                }}
                tools={tools}
                onInitialize={editor => {
                    const api = editor.dangerouslyLowLevelInstance;

                    api.isReady.then(() => {
                        setEditorInstance(api);

                        const hasInitialData = value && JSON.parse(value).blocks.length > 0;
                        const initialData = hasInitialData ? JSON.parse(value) : null;

                        if (toolpackModule !== null && toolpackModule.customiseInstance !== undefined) {
                            toolpackModule.customiseInstance(api, initialData);
                        }

                        if(hasInitialData) {
                            api.render(initialData)
                        }
                        
                    })
                }}
            />
        </>)}

      </div>
      <MediaLibComponent
        isOpen={isMediaLibOpen}
        onChange={handleMediaLibChange}
        onToggle={mediaLibToggleFunc}
      />
    </>
  );
};

Editor.propTypes = {
  onChange: PropTypes.func.isRequired,
  name: PropTypes.string.isRequired,
  value: PropTypes.string,
};

export default Editor;
