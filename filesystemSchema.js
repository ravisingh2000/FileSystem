//Sqlite Schema Library
const sqlite3 = require("sqlite3").verbose()

//Data base credets
// name of database:FileSystem
// name of table:filesystem
const db = new sqlite3.Database("./FileSystem.db", sqlite3.OPEN_READWRITE, (err) => {
    if (err) return console.error(err.message);
    console.log("connection sucessfully")
})

//Here I use filepath to check whether file exist or not we can also use forloop to check path exist or not
// for that i use this table schema
function createTable() {
    db.run("CREATE TABLE filesystem(DirectoryIndex INTEGER PRIMARY KEY AUTOINCREMENT ,Parent_directory INTEGER,Name TEXT UNIQUE,Content TEXT,Type TEXT,Filepath TEXT,DateCreated TEXT,DateModified TEXT)")
}

//Wrap the query with promise
function select(newquery) {
    return new Promise((resolve, reject) => {
        const queries = [];
        db.all(newquery, (err, n) => {
            if (err) {
                reject(err);
            } else {
                resolve(n); // resolve the promise
            }
        });
    });
}

async function create(path, type) {
    if (path == '/') return false;
    let finalpath = path.split("/");
    const newElement = finalpath.pop();
    finalpath = finalpath.join('/')
    let parentDirectory = 0;
    let content;
    if (finalpath != '') {
        //check given path for inserting that element is exist or not
        const checkPathExist = await select(`SELECT * FROM filesystem where FilePath='${finalpath}'  `)
        if (checkPathExist.length == 0) {
            return false;
        }
        else {
            //given path is exist so I store  parentdirectory index
            parentDirectory = checkPathExist[0].DirectoryIndex
        }
    }

    //check new inserted element already exist or not
    const checkNewElementExist = await select(`SELECT * FROM filesystem where FilePath='${path}'  `)
    if (checkNewElementExist.length > 0) {
        return false;
    }
    //then inserted element to given path
    let rowCount = await select(`SELECT COUNT(*) FROM filesystem`)
    if (type == 'file') content = "file fresh content "; else null
    const createdDate = new Date(Date.now()).toISOString()
    db.run(`INSERT INTO filesystem( Parent_directory, Name,Content,Type,FilePath,DateCreated)VALUES(?,?,?,?,?,?)`, [parentDirectory, newElement, content, type, path, createdDate], (err) => {
        if (err) return console.error(err.message);
        console.log("Element is inserted")
    })
    return true;
}

async function scan(dir_path) {
    //here I check all sub elments of that
    let elements;
    if (dir_path == '/') {
        //for root directory 
        elements = await select(`SELECT * FROM filesystem WHERE Parent_directory=0`)
    }
    else {
        // for other than root directory 
        elements = await select(`SELECT * FROM filesystem WHERE Parent_directory=(SELECT DirectoryIndex FROM filesystem WHERE FilePath='${dir_path}')`)
    }
    if (elements.length > 0) {
        elements = elements.map((value) => {
            return value.Name;
        })
    }
    return elements;
}

async function read(file_path) {

    let filecontent = await select(`SELECT * FROM filesystem WHERE FilePath='${file_path}'`)
    if (filecontent.length == 0 || filecontent[0].Type == 'folder') {
        return null;
    }
    return filecontent[0].Content
}

async function write(file_path, string_content) {
    //file path  is exist or not
    let filecontent = await select(`SELECT * FROM filesystem WHERE FilePath='${file_path}'`)
    if (filecontent.length == 0 || filecontent[0].Type == 'folder') {
        return false;
    }
    //updated file content
    const updatedDate = new Date(Date.now()).toISOString()
    db.run(`UPDATE filesystem SET Content = '${string_content}', DateModified= '${updatedDate}' WHERE FilePath='${file_path}' `, (err) => {
        if (err) return console.error(err.message);
        console.log("CONTENT IS UPDATED")
    })

    return true;
}
async function rename(elm_path, new_name) {
    //element path is exist or not
    let filecontent = await select(`SELECT * FROM filesystem WHERE FilePath='${elm_path}'`)
    if (filecontent.length == 0) {
        return false;
    }
    //rename the name of element
    const updatedDate = new Date(Date.now()).toISOString()
    db.run(`UPDATE filesystem SET Name = '${new_name}', DateModified= '${updatedDate}' WHERE FilePath='${elm_path}' `, (err) => {
        if (err) return console.error(err.message);
        console.log("NAME IS UPDATED")
    })

    return true;
}

async function mtime(file_path) {
    //element path is exist or not
    let filecontent = await select(`SELECT * FROM filesystem WHERE FilePath='${file_path}'`)
    if (filecontent.length == 0) {
        return -1;
    }
    //return modified unixtime
    const date = new Date(filecontent[0].DateModified);
    const unixTimeStamp = Math.floor(date.getTime() / 1000);
    return unixTimeStamp
}
async function ctime(file_path) {
    //element path is exist or not
    let filecontent = await select(`SELECT * FROM filesystem WHERE FilePath='${file_path}'`)
    if (filecontent.length == 0) {
        return -1;
    }
    //return created unixtime
    const date = new Date(filecontent[0].DateCreated);
    const unixTimeStamp = Math.floor(date.getTime() / 1000);
    return unixTimeStamp
}

async function deleteElement(elem_path) {
    //element path is exist or not
    const delElementExist = await select(`SELECT * FROM filesystem where FilePath='${elem_path}'  `)
    if (delElementExist.length == 0) {
        console.log('Delete Element NOT Exist');
        return false;
    }
    // path contain last element file
    if (delElementExist[0].Type == 'file') {
        db.run(`DELETE FROM filesystem WHERE  DirectoryIndex=${delElementExist[0].DirectoryIndex}; `, (err) => {
            if (err) return console.error(err.message);
            console.log("File Deleted sucessfully");
        })
        return true;
    }

    else {
        //recursive query   to delete folder and  it's subfolder
        let deletedElements = await select(`WITH Recursive virtualDeleteTable(DirectoryIndex, Name,Parent_directory)  AS(
            SELECT i.DirectoryIndex,i.Name,i.Parent_directory From filesystem i where   i.DirectoryIndex=${delElementExist[0].DirectoryIndex}
            UNION ALL
            SELECT i.DirectoryIndex,i.Name,i.Parent_directory FROM  filesystem i Join virtualDeleteTable j
            ON j.DirectoryIndex==i.Parent_directory)
            SELECT * FROM virtualDeleteTable;`)
        if (deletedElements.length == 0) {
            return false;
        }
        //subfolder deleted
        for (let deletedIndexed in deletedElements) {
            if (delElementExist[0].DirectoryIndex != deletedElements[deletedIndexed].DirectoryIndex) {
                db.run(`DELETE FROM filesystem WHERE  DirectoryIndex=${deletedElements[deletedIndexed].DirectoryIndex} `, (err) => {
                    if (err) return console.error(err.message);
                    console.log(`[${deletedElements[deletedIndexed].Name}] Subfolder Deleted `);
                })
            }
        }

        //then parentelement is deleted
        db.run(`DELETE FROM filesystem WHERE  DirectoryIndex=${delElementExist[0].DirectoryIndex} `, (err) => {
            if (err) return console.error(err.messge);
            console.log(`[${delElementExist[0].DirectoryIndex.Name}] Folder Deleted `);
        })
        return true;

    }
}

async function move(elm_path, dir_path) {
    let currentpath = elm_path.split("/")
    let moveElement = currentpath.pop()
    currentpath = currentpath.join('/')

    //here I check folder can't move to it subfolder
    if (dir_path.includes(elm_path)) {
        return false;
    }

    const previousPath = await select(`SELECT * FROM filesystem where FilePath='${elm_path}'  `)
    const newpath = await select(`SELECT * FROM filesystem where FilePath='${dir_path}'  `)
    if (previousPath == 0 || newpath == 0 || newpath[0].Type == 'file') {
        return false;
    }
    // here I get all the subfolders or file of moved directory
    let elements = await select(`WITH Recursive virtualDeleteTable(DirectoryIndex, Name,Parent_directory,Filepath)  AS(
        SELECT i.DirectoryIndex,i.Name,i.Parent_directory,i.Filepath From filesystem i where   i.DirectoryIndex=${previousPath[0].DirectoryIndex}
        UNION ALL
        SELECT i.DirectoryIndex,i.Name,i.Parent_directory,i.Filepath FROM  filesystem i Join virtualDeleteTable j
        ON j.DirectoryIndex==i.Parent_directory)
        SELECT * FROM virtualDeleteTable;`)
    const updatedDate = new Date(Date.now()).toISOString()

    //then  updated filepath and datemodified of all subfolder of movedirectory
    for (let elementIndex in elements) {
        if (elements[elementIndex].Parent_directory != previousPath[0].DirectoryIndex) {
            let newfilePath = dir_path + elements[elementIndex].Filepath.split(currentpath)[1]
            db.run(`UPDATE filesystem SET filePath = '${newfilePath}' , DateModified='${updatedDate}' WHERE DirectoryIndex='${elements[elementIndex].DirectoryIndex}' `, (err) => {
                if (err) return console.error(err.message);
                // console.log("UPDATED")
            })

        }
    }
    //then i linked moveddirectory to   newdirectory or file
    let newfilePath = dir_path + '/' + moveElement;
    db.run(`UPDATE filesystem SET  Parent_directory=${newpath[0].DirectoryIndex},FilePath='${newfilePath}', DateModified= '${updatedDate}' WHERE DirectoryIndex = ${previousPath[0].DirectoryIndex} `, (err) => {
        if (err) return console.error(err.message);
        // console.log(" UPDATED")
    })

    return true;

}
async function tableData() {
    try {
        const selectsql = 'SELECT * FROM filesystem;'
        let message = await select(selectsql)
        return message

    }
    catch (error) {
        console.log(error);
    }
}
//All function for filesystem Schema
async function fileSystemLibrary() {

    // createTable()

    // let createstatus = await create('/sbi/ux', 'folder')
    // console.log(createstatus);

    // let movestatus = await move('/pnb/io', '/op/jk')
    // console.log(movestatus);

    // let scanstatus = await scan('/pnb/ux/ui')
    // console.log(scanstatus);

    // let deletestatus = await deleteElement("/UH/JK")
    // console.log(deletestatus);

    // let createdTime = await ctime('/yesbank/mean.txt')
    // console.log(createdTime);

    // let modifiedTime = await mtime('/op/jk/io', 'newSone')
    // console.log(modifiedTime);

    // let writestatus = await write('/op/jk/io.txt', 'newSone')
    // console.log(writestatus);

    // let renamestatus = await rename('/pnb', 'new')
    // console.log(renamestatus);

    // let readstatus = await read('/op/jk/io.txt');
    // console.log(readstatus);

    //table data
    let tablestatus = await tableData()
    console.log(tablestatus);

}

fileSystemLibrary()


// db.close((err) => {
//     if (err) return console.error(err.message);
// })
